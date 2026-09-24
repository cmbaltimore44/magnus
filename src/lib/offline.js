// Offline mode: a fetch layer between supabase-js and the network.
//
//   reads   every successful REST GET is cached (~/.config/magnus/cache.json,
//           mode 600). When the network is down, the cached answer is served.
//   writes  made while offline are queued (same file) and answered locally
//           as PostgREST would, and applied to the cached reads so every view
//           shows them at once. When the network is back, the queue replays
//           in order with a fresh access token.
//
// Inserts get a client-side id up front (online too), so a queued row keeps
// the same id when it reaches the server and later edits to it line up.
// Conflicts are last-write-wins, same as two browser tabs. Only
// /rest/v1/ goes through here; auth requests pass straight to the network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magnus');
const FILE = path.join(DIR, 'cache.json');
const OBJECT = 'application/vnd.pgrst.object+json';

// ---------- a tiny PostgREST query evaluator over cached rows ----------

function parseValue(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return decodeURIComponent(v);
}

export function parseQuery(url) {
  const u = new URL(url);
  const table = u.pathname.split('/rest/v1/')[1]?.split('/')[0];
  const filters = [];
  let order = [];
  let select = '*';
  for (const [key, raw] of u.searchParams) {
    if (key === 'select') select = raw;
    else if (key === 'order') order = raw.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' }; });
    else if (['limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    else {
      const m = /^(eq|neq|gte|lte|gt|lt|in|is)\.(.*)$/.exec(raw);
      if (m) filters.push({ col: key, op: m[1], value: m[2] });
    }
  }
  return { table, filters, order, select };
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function rowMatches(row, filters) {
  return filters.every(({ col, op, value }) => {
    const v = row[col];
    if (op === 'in') return value.replace(/^\(|\)$/g, '').split(',').map(parseValue).map(String).includes(String(v));
    const want = parseValue(value);
    if (op === 'is') return v === want;
    if (op === 'eq') return String(v) === String(want);
    if (op === 'neq') return String(v) !== String(want);
    const c = cmp(v, typeof v === 'number' ? Number(want) : want);
    return v != null && (op === 'gte' ? c >= 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c < 0);
  });
}

function project(row, select) {
  if (!select || select === '*') return { ...row };
  const out = {};
  for (const c of select.split(',').map((s) => s.trim())) if (c in row) out[c] = row[c];
  return out;
}

function sortRows(rows, order) {
  if (!order.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, desc } of order) {
      const c = cmp(a[col], b[col]);
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

// Same rule as schema_003's tasks_completed_at trigger.
function applyTriggers(table, row, before) {
  if (table !== 'tasks' || !('status' in row)) return row;
  if (row.status === 'done') {
    if (!before || before.status !== 'done') row.completed_at = row.completed_at || new Date().toISOString();
  } else {
    row.completed_at = null;
  }
  return row;
}

// ---------- store ----------

export function createOfflineStore({ file = FILE, persist = true } = {}) {
  let data = { reads: {}, queue: [] };
  if (persist) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
      data.reads ||= {};
      data.queue ||= [];
    } catch {
      // first run or unreadable: start empty
    }
  }
  let saveTimer = null;
  const save = (now = false) => {
    if (!persist) return;
    const write = () => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}`;
        fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
        fs.renameSync(tmp, file);
      } catch {
        // cache is best-effort
      }
    };
    clearTimeout(saveTimer);
    if (now) write();
    else saveTimer = setTimeout(write, 300);
  };
  return {
    data: () => data,
    save,
    clear() {
      data = { reads: {}, queue: [] };
      if (persist) {
        try {
          fs.rmSync(file, { force: true });
        } catch {
          // gone
        }
      }
    },
  };
}

// Apply a write to every cached read of that table.
export function applyToReads(reads, method, url, payload) {
  const q = parseQuery(url);
  for (const [key, entry] of Object.entries(reads)) {
    const rq = parseQuery(entry.url);
    if (rq.table !== q.table) continue;
    const single = entry.accept === OBJECT;
    let rows = single ? (entry.body == null ? [] : [entry.body]) : entry.body;
    if (!Array.isArray(rows)) continue;
    if (method === 'POST') {
      for (const row of payload) if (rowMatches(row, rq.filters) && !rows.some((r) => r.id === row.id)) rows = [...rows, project(row, rq.select)];
      rows = sortRows(rows, rq.order);
    } else if (method === 'PATCH') {
      rows = rows.map((r) => (rowMatches(r, q.filters) ? project(applyTriggers(q.table, { ...r, ...payload }, r), rq.select) : r));
      rows = sortRows(rows.filter((r) => rowMatches(r, rq.filters)), rq.order);
    } else if (method === 'DELETE') {
      rows = rows.filter((r) => !rowMatches(r, q.filters));
    }
    reads[key] = { ...entry, body: single ? rows[0] ?? null : rows };
  }
}

// Rows a PATCH touches, from whatever the cache knows (for the local answer).
function cachedRows(reads, url) {
  const q = parseQuery(url);
  const byId = new Map();
  for (const entry of Object.values(reads)) {
    if (parseQuery(entry.url).table !== q.table) continue;
    const rows = entry.accept === OBJECT ? [entry.body].filter(Boolean) : entry.body;
    if (!Array.isArray(rows)) continue;
    for (const r of rows) if (r.id && rowMatches(r, q.filters)) byId.set(r.id, { ...byId.get(r.id), ...r });
  }
  return [...byId.values()];
}

// ---------- the fetch wrapper ----------

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const hit = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit ? headers[hit] : null;
}

function isNetworkError(err) {
  return err instanceof TypeError || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(err?.code || err?.cause?.code);
}

function jsonResponse(body, status, accept) {
  const payload = accept === OBJECT && Array.isArray(body) ? body[0] ?? null : body;
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-magnus-offline': '1' },
  });
}

export function makeOfflineFetch(baseFetch, { store = createOfflineStore(), getToken = async () => null } = {}) {
  let offline = false;
  let replaying = null;
  let lastFailures = [];
  const listeners = new Set();
  const status = () => ({ offline, queued: store.data().queue.length });
  const emit = (event) => listeners.forEach((l) => l({ ...status(), event }));
  const setOffline = (v) => {
    if (offline === v) return;
    offline = v;
    emit(v ? 'offline' : 'online');
    if (!v) replay();
  };

  async function replay() {
    if (replaying) return replaying;
    replaying = (async () => {
      const q = store.data().queue;
      let synced = 0;
      const failed = [];
      while (q.length) {
        const job = q[0];
        const token = await getToken();
        const headers = { ...job.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        let res;
        try {
          res = await baseFetch(job.url, { method: job.method, headers, body: job.body });
        } catch (err) {
          if (isNetworkError(err)) {
            offline = true;
            emit('offline');
            break;
          }
          res = null;
        }
        q.shift();
        store.save();
        if (res && res.ok) synced++;
        else failed.push({ job, status: res?.status, message: res ? await res.text().catch(() => '') : 'error' });
      }
      store.save(true);
      lastFailures = failed;
      replaying = null;
      if (synced || failed.length) emit(failed.length ? 'sync-errors' : 'synced');
    })();
    return replaying;
  }

  async function offlineFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/rest/v1/')) return baseFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    const accept = headerValue(init.headers, 'Accept') || 'application/json';
    const reads = store.data().reads;
    const key = `${accept === OBJECT ? 'one' : 'many'} ${url}`;

    let body = init.body;
    if (method === 'POST' && typeof body === 'string') {
      // Client-side ids (see top), so a queued insert keeps its identity.
      try {
        const parsed = JSON.parse(body);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        rows.forEach((r) => {
          if (r && typeof r === 'object' && !r.id) r.id = randomUUID();
        });
        body = JSON.stringify(Array.isArray(parsed) ? rows : rows[0]);
      } catch {
        // not JSON: leave as is
      }
    }

    if (method === 'GET' || method === 'HEAD') {
      try {
        const res = await baseFetch(input, init);
        setOffline(false);
        if (res.ok && method === 'GET') {
          const text = await res.clone().text();
          try {
            reads[key] = { url, accept, body: JSON.parse(text) };
            store.save();
          } catch {
            // non-JSON response: don't cache
          }
        }
        return res;
      } catch (err) {
        if (!isNetworkError(err) || !reads[key]) throw err;
        setOffline(true);
        return jsonResponse(reads[key].body, 200, accept);
      }
    }

    // Writes: straight through when online (and the queue is empty, so order holds).
    if (!offline && !store.data().queue.length) {
      try {
        const res = await baseFetch(input, { ...init, body });
        if (res.ok) applyToReads(reads, method, url, method === 'DELETE' ? null : responseRows(method, body, await res.clone().json().catch(() => null)));
        return res;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        setOffline(true);
      }
    }

    // Queue it and answer locally.
    const headers = {};
    for (const h of ['Content-Type', 'Prefer', 'Accept', 'apikey']) {
      const v = headerValue(init.headers, h);
      if (v) headers[h] = v;
    }
    store.data().queue.push({ method, url, headers, body, at: Date.now() });
    store.save(true);
    emit('queued');
    if (!offline) replay(); // online but behind older queued writes: flush now
    if (method === 'DELETE') {
      applyToReads(reads, 'DELETE', url, null);
      return jsonResponse(null, 204, accept);
    }
    const payload = JSON.parse(body || '{}');
    if (method === 'POST') {
      const rows = (Array.isArray(payload) ? payload : [payload]).map((r) => applyTriggers(parseQuery(url).table, { created_at: new Date().toISOString(), ...r }, null));
      applyToReads(reads, 'POST', url, rows);
      return jsonResponse(rows, 201, accept);
    }
    // PATCH
    const before = cachedRows(reads, url);
    applyToReads(reads, 'PATCH', url, payload);
    const table = parseQuery(url).table;
    const after = before.map((r) => applyTriggers(table, { ...r, ...payload }, r));
    return jsonResponse(after, 200, accept);
  }

  function responseRows(method, body, json) {
    if (Array.isArray(json)) return method === 'PATCH' ? json[0] || JSON.parse(body || '{}') : json;
    if (json && typeof json === 'object') return method === 'PATCH' ? json : [json];
    const parsed = JSON.parse(body || '{}');
    return method === 'PATCH' ? parsed : Array.isArray(parsed) ? parsed : [parsed];
  }

  // While offline (or with writes waiting), probe now and then so the queue
  // flushes soon after the network comes back.
  const probe = setInterval(async () => {
    if (!offline && !store.data().queue.length) return;
    const any = Object.values(store.data().reads)[0];
    if (!any) return;
    try {
      const token = await getToken();
      const apikey = store.data().queue[0]?.headers?.apikey;
      await baseFetch(any.url, { headers: { ...(apikey ? { apikey } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      setOffline(false);
      if (store.data().queue.length) replay();
    } catch {
      // still offline
    }
  }, 20000);
  probe.unref?.();

  offlineFetch.status = status;
  offlineFetch.subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  offlineFetch.replay = replay;
  offlineFetch.failures = () => lastFailures;
  offlineFetch.clear = () => store.clear();
  offlineFetch.setTokenProvider = (fn) => {
    getToken = fn;
  };
  return offlineFetch;
}
