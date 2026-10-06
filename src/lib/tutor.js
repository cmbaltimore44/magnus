// Magnus Tutor client: the tutor is a separate local app (magnus-tutor repo,
// http://127.0.0.1:8765). Magnus starts it when needed (`tutor start`), asks
// questions over its plain-text endpoint, and opens sessions in the browser.
// Nothing here touches Supabase.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPref } from './prefs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function tutorUrl() {
  if (process.env.MAGNUS_TUTOR_URL) return process.env.MAGNUS_TUTOR_URL.replace(/\/$/, '');
  let port = 8765;
  try {
    const s = fs.readFileSync(path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magnus-tutor', 'settings.yaml'), 'utf8');
    const m = /^server:\s*\n(?:[ \t]+.*\n)*?[ \t]+port:\s*(\d+)/m.exec(s);
    if (m) port = Number(m[1]);
  } catch {
    // defaults
  }
  return getPref('tutorUrl', `http://127.0.0.1:${port}`);
}

/** The `tutor` command: env, pref, PATH, or the sibling checkout next to Magnus. */
export function tutorCommand() {
  const candidates = [
    process.env.MAGNUS_TUTOR_BIN,
    getPref('tutorCommand', null),
    path.resolve(HERE, '..', '..', '..', 'magnus-tutor', '.venv', 'bin', 'tutor'), // dist/ or src/lib → repo → sibling
    path.resolve(HERE, '..', '..', 'magnus-tutor', '.venv', 'bin', 'tutor'),
    path.join(os.homedir(), 'Development', 'magnus-tutor', '.venv', 'bin', 'tutor'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'tutor';
}

async function fetchJson(url, opts = {}, timeout = 4000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200) || r.statusText);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function tutorUp() {
  try {
    await fetchJson(`${tutorUrl()}/api/health`, {}, 1500);
    return true;
  } catch {
    return false;
  }
}

/** Start the tutor backend if it isn't running. Resolves when it answers. */
export async function ensureTutor() {
  if (await tutorUp()) return true;
  const cmd = tutorCommand();
  // `tutor start` detaches the backend itself and exits once it answers.
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, ['start', '--no-open'], { stdio: 'ignore' });
    child.on('error', (err) => reject(new Error(`couldn't start the tutor (${cmd}): ${err.message}`)));
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tutor start exited ${code}`))));
  });
  for (let i = 0; i < 40; i++) {
    if (await tutorUp()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('the tutor backend did not start (try `tutor start` in a terminal)');
}

export const api = {
  courses: () => fetchJson(`${tutorUrl()}/api/courses`),
  review: () => fetchJson(`${tutorUrl()}/api/review`).catch(() => []),
  sessions: (course) => fetchJson(`${tutorUrl()}/api/sessions?limit=8${course ? `&course=${encodeURIComponent(course)}` : ''}`),
  createSession: (course, mode, title) => fetchJson(`${tutorUrl()}/api/sessions`, { method: 'POST', body: JSON.stringify({ course, mode, title }) }),
  scan: () => fetchJson(`${tutorUrl()}/api/library/scan`, { method: 'POST', body: '{}' }),
};

/**
 * Ask a question; `onText(chunk)` streams the plain-text answer (math stays as
 * LaTeX text). Returns the session id, so follow-ups continue the conversation.
 */
export async function ask(text, { course = null, sessionId = null, onText = () => {}, signal } = {}) {
  const r = await fetch(`${tutorUrl()}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, course, session_id: sessionId }),
    signal,
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200) || r.statusText);
  const sid = Number(r.headers.get('x-session-id')) || sessionId;
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onText(dec.decode(value, { stream: true }));
  }
  return sid;
}

/** Open the web app (optionally at a path like /session/12) in the default browser. */
export function openWeb(p = '/') {
  const url = `${tutorUrl()}${p.startsWith('/') ? p : `/${p}`}`;
  // Only ever hand `open` a local http URL (never something it could read as an option or a file).
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) return Promise.resolve(false);
  return new Promise((resolve) => execFile('open', [url], (err) => resolve(!err)));
}

/** The focus-round label for a problem-set session, e.g. "office hours: E&M PSet 3". */
export function officeHoursLabel(courseName, pset) {
  return `office hours: ${courseName}${pset ? ` ${pset}` : ''}`.slice(0, 120);
}
