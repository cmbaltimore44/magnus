// Offline layer: cached reads, queued writes answered locally, replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOfflineFetch, createOfflineStore, parseQuery, rowMatches } from '../src/lib/offline.js';

const BASE = 'https://x.supabase.co/rest/v1';

// A pretend PostgREST server for one table, with an on/off network switch.
function fakeServer() {
  const rows = [{ id: 'a', title: 'one', status: 'todo', sort_order: 0 }];
  const log = [];
  let up = true;
  const fetch = async (url, init = {}) => {
    if (!up) throw new TypeError('fetch failed');
    const method = (init.method || 'GET').toUpperCase();
    log.push({ method, url, auth: init.headers?.Authorization });
    const q = parseQuery(url);
    if (method === 'GET') return new Response(JSON.stringify(rows.filter((r) => rowMatches(r, q.filters))), { status: 200 });
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      rows.push(body);
      return new Response(JSON.stringify([body]), { status: 201 });
    }
    if (method === 'PATCH') {
      const patch = JSON.parse(init.body);
      rows.filter((r) => rowMatches(r, q.filters)).forEach((r) => Object.assign(r, patch));
      return new Response(JSON.stringify(rows.filter((r) => rowMatches(r, q.filters))), { status: 200 });
    }
    if (method === 'DELETE') {
      for (let i = rows.length - 1; i >= 0; i--) if (rowMatches(rows[i], q.filters)) rows.splice(i, 1);
      return new Response(null, { status: 204 });
    }
  };
  return { rows, log, fetch, set up(v) { up = v; } };
}

test('parseQuery / rowMatches understand the filters Magnus uses', () => {
  const q = parseQuery(`${BASE}/tasks?select=id,title&id=eq.a&order=sort_order.asc`);
  assert.equal(q.table, 'tasks');
  assert.deepEqual(q.order, [{ col: 'sort_order', desc: false }]);
  assert.ok(rowMatches({ id: 'a' }, q.filters));
  assert.ok(!rowMatches({ id: 'b' }, q.filters));
  assert.ok(rowMatches({ d: '2026-09-24' }, parseQuery(`${BASE}/t?d=gte.2026-09-01`).filters));
});

test('offline: cached reads, local answers for writes, replay on reconnect', async () => {
  const server = fakeServer();
  const store = createOfflineStore({ persist: false });
  const f = makeOfflineFetch(server.fetch, { store, getToken: async () => 'fresh-token' });
  const list = `${BASE}/tasks?select=*&order=sort_order.asc`;
  const events = [];
  f.subscribe((s) => events.push(s.event));

  assert.equal((await (await f(list)).json()).length, 1); // online, cached
  server.up = false;
  const cached = await f(list);
  assert.equal(cached.headers.get('x-magnus-offline'), '1');
  assert.equal((await cached.json())[0].title, 'one');
  assert.equal(f.status().offline, true);

  // Insert while offline: gets an id, shows up in the cached list at once.
  const created = await (await f(`${BASE}/tasks?select=*`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.pgrst.object+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'two', status: 'done', sort_order: 1 }),
  })).json();
  assert.ok(created.id);
  assert.ok(created.completed_at, 'completed_at trigger emulated');
  // Update and delete while offline.
  await f(`${BASE}/tasks?id=eq.a`, { method: 'PATCH', headers: { Accept: 'application/vnd.pgrst.object+json' }, body: JSON.stringify({ title: 'uno' }) });
  let now = await (await f(list)).json();
  assert.deepEqual(now.map((r) => r.title), ['uno', 'two']);
  await f(`${BASE}/tasks?id=eq.${created.id}`, { method: 'DELETE' });
  now = await (await f(list)).json();
  assert.deepEqual(now.map((r) => r.title), ['uno']);
  assert.equal(f.status().queued, 3);
  assert.equal(server.rows.length, 1); // nothing reached the server yet

  // Back online: the next read flips us online and replays in order.
  server.up = true;
  await f(list);
  await f.replay();
  assert.equal(f.status().queued, 0);
  assert.deepEqual(server.rows.map((r) => r.title), ['uno']);
  const replayed = server.log.filter((l) => l.method !== 'GET');
  assert.deepEqual(replayed.map((l) => l.method), ['POST', 'PATCH', 'DELETE']);
  assert.ok(replayed.every((l) => l.auth === 'Bearer fresh-token'));
  assert.ok(events.includes('offline') && events.includes('synced'));
});

test('offline: a read that was never cached still fails', async () => {
  const server = fakeServer();
  const f = makeOfflineFetch(server.fetch, { store: createOfflineStore({ persist: false }) });
  server.up = false;
  await assert.rejects(() => f(`${BASE}/books?select=*`), TypeError);
});
