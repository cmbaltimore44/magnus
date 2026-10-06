// The one focus timer, shared by the TUI, `magnus timer …` and Magnus Tutor:
// ~/.config/magnus/timer.json (schema in magnus-tutor/docs/timer-contract.md).
// Writes take a lock, re-read the latest file, write a temp file and rename
// it into place, so readers never see half a file and concurrent commands
// apply in order. `version` goes up on every write.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS, settingsFrom } from './pomodoro.js';

export const SCHEMA = 1;
export const ALERTS = ['auto', 'terminal', 'web', 'both'];

function dir() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magnus');
}
export const timerFile = () => path.join(dir(), 'timer.json');
export const tuiFile = () => path.join(dir(), 'tui.json');
const lockDir = () => path.join(dir(), 'timer.lock');

// Demo mode and tests never touch real files: they use this in-memory file.
let memory = null;
const inMemory = () => !!process.env.MAGNUS_DEMO && !process.env.MAGNUS_TIMER_FILES;

function empty(prefs) {
  return { schema: SCHEMA, version: 0, updated_at: 0, updated_by: null, alerts: 'auto', settings: settingsFrom(prefs || {}), timer: null };
}

function parse(text) {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object' || d.schema !== SCHEMA) throw new Error('not a timer file');
  return { ...empty(), ...d, settings: settingsFrom(d.settings || {}) };
}

// The older single-countdown timer: keep it running as round 1.
function migrateTimer(t) {
  if (!t || t.phase) return t;
  return { ...t, phase: 'focus', round: 0, status: 'running' };
}

/** Read the current file (or a fresh empty one). Never throws. */
export function readTimerFile() {
  if (inMemory()) return memory ? structuredClone(memory) : empty();
  try {
    return parse(fs.readFileSync(timerFile(), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return migrateFromPrefs();
    return { ...empty(), corrupt: true };
  }
}

// First run after this change: move a timer kept in prefs.json into timer.json.
function migrateFromPrefs() {
  try {
    const prefs = JSON.parse(fs.readFileSync(path.join(dir(), 'prefs.json'), 'utf8'));
    const d = empty({ focus: prefs.focusMinutes, short: prefs.breakMinutes, long: prefs.longBreakMinutes, every: prefs.longBreakEvery });
    d.timer = migrateTimer(prefs.focusTimer ?? null);
    return d;
  } catch {
    return empty();
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(fn) {
  if (inMemory()) return fn();
  fs.mkdirSync(dir(), { recursive: true });
  const lock = lockDir();
  const deadline = Date.now() + 3000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 5000) fs.rmSync(lock, { recursive: true, force: true }); // stale
      } catch {
        // gone already
      }
      if (Date.now() > deadline) throw new Error('timer file is locked by another Magnus');
      sleep(15);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function writeAtomic(d) {
  if (inMemory()) {
    memory = structuredClone(d);
    return;
  }
  const file = timerFile();
  if (d.corrupt) {
    try {
      fs.renameSync(file, `${file}.corrupt`);
    } catch {
      // nothing to move aside
    }
  }
  const { corrupt, ...clean } = d;
  void corrupt;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * Read-modify-write under the lock. `fn(file)` returns a patch
 * { timer?, alerts?, settings? }, or undefined to change nothing (no write).
 * Returns the file as it is afterwards.
 */
export function updateTimerFile(fn, by = 'tui') {
  return withLock(() => {
    const cur = readTimerFile();
    const patch = fn(cur);
    if (!patch) return cur;
    const next = { ...cur };
    if ('timer' in patch) next.timer = patch.timer;
    if ('alerts' in patch) next.alerts = patch.alerts;
    if ('settings' in patch) next.settings = settingsFrom(patch.settings);
    next.version = (cur.version || 0) + 1;
    next.updated_at = Date.now();
    next.updated_by = by;
    writeAtomic(next);
    return next;
  });
}

export const getTimer = () => migrateTimer(readTimerFile().timer);
export const setTimer = (t, by = 'tui') => updateTimerFile(() => ({ timer: t }), by);

/** Keep the pomodoro lengths in timer.json in step with the Settings screen. */
export function syncSettings(settings, by = 'tui') {
  const cur = readTimerFile();
  const s = settingsFrom(settings);
  if (JSON.stringify(cur.settings) === JSON.stringify(s)) return cur;
  return updateTimerFile(() => ({ settings: s }), by);
}

export function setAlerts(mode, by = 'cli') {
  if (!ALERTS.includes(mode)) throw new Error(`alerts must be one of ${ALERTS.join(', ')}`);
  return updateTimerFile(() => ({ alerts: mode }), by);
}

// ---------- is the TUI open? ----------

export function writeHeartbeat() {
  if (inMemory()) return;
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = `${tuiFile()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, heartbeat_at: Date.now() }));
    fs.renameSync(tmp, tuiFile());
  } catch {
    // best effort
  }
}

export function clearHeartbeat() {
  if (inMemory()) return;
  try {
    const d = JSON.parse(fs.readFileSync(tuiFile(), 'utf8'));
    if (d.pid === process.pid) fs.rmSync(tuiFile(), { force: true });
  } catch {
    // not ours or not there
  }
}

export function tuiAlive(now = Date.now()) {
  if (inMemory()) return false;
  try {
    const d = JSON.parse(fs.readFileSync(tuiFile(), 'utf8'));
    if (now - d.heartbeat_at > 45000) return false;
    process.kill(d.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Should the terminal ring when a phase ends? */
export function terminalRings(alerts, alive) {
  if (alerts === 'terminal' || alerts === 'both') return true;
  if (alerts === 'web') return false;
  return alive; // auto
}

/** Watch timer.json for changes made elsewhere (FSEvents, no polling). */
export function watchTimerFile(onChange) {
  if (inMemory()) return () => {};
  let watcher;
  try {
    fs.mkdirSync(dir(), { recursive: true });
    watcher = fs.watch(dir(), (_, name) => {
      if (name === 'timer.json') onChange();
    });
  } catch {
    return () => {};
  }
  return () => watcher.close();
}

export function resetMemoryTimer() {
  memory = null;
}

export { DEFAULTS };
