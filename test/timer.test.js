// The shared focus timer: timer.json store, `magnus timer` ≡ TUI keys, and
// changes made outside the TUI showing up in it.
import './_demo.js';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import * as P from '../src/lib/pomodoro.js';
import { planAction, runAction, snapshot } from '../src/lib/timerActions.js';
import { readTimerFile, terminalRings, timerFile, updateTimerFile } from '../src/lib/timerStore.js';
import { useFocusTimer } from '../src/ui/useFocusTimer.js';

const run = promisify(execFile);
const S = P.settingsFrom({});
const M = 60000;
const BIN = path.resolve('bin/magnus.js');
let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-timer-'));
  process.env.XDG_CONFIG_HOME = dir;
  process.env.MAGNUS_TIMER_FILES = '1'; // real files (in a temp dir) instead of demo memory
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true }); // don't leave temp dirs behind
});

const cli = (...args) => run(process.execPath, [BIN, 'timer', ...args], { env: { ...process.env } });
const noLog = async () => false;

test('writes are atomic, versioned, and leave no temp files', () => {
  assert.equal(readTimerFile().timer, null);
  updateTimerFile(() => ({ timer: P.startFocus({ label: 'x' }, S, 0) }), 'cli');
  const a = readTimerFile();
  assert.equal(a.version, 1);
  assert.equal(a.timer.label, 'x');
  assert.equal(updateTimerFile(() => undefined).version, 1, 'no-op updates do not write');
  updateTimerFile(() => ({ alerts: 'web' }));
  assert.equal(readTimerFile().version, 2);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'magnus')).sort(), ['timer.json']);
});

test('a corrupted file reads as no timer and is moved aside on the next write', () => {
  fs.mkdirSync(path.join(dir, 'magnus'), { recursive: true });
  fs.writeFileSync(timerFile(), '{"schema": 1, "timer": {');
  assert.equal(readTimerFile().timer, null);
  updateTimerFile(() => ({ timer: null }));
  assert.ok(fs.existsSync(`${timerFile()}.corrupt`));
  assert.equal(readTimerFile().schema, 1);
});

test('a timer kept in prefs.json by older Magnus is migrated', () => {
  fs.mkdirSync(path.join(dir, 'magnus'), { recursive: true });
  const old = { taskId: 't1', title: 'Essay', startedAt: 1000, minutes: 25, pausedAt: null, pausedMs: 0 };
  fs.writeFileSync(path.join(dir, 'magnus', 'prefs.json'), JSON.stringify({ focusTimer: old, focusMinutes: 30 }));
  const f = readTimerFile();
  assert.equal(f.timer.phase, 'focus');
  assert.equal(f.timer.title, 'Essay');
  assert.equal(f.settings.focus, 30);
});

test('actions keep the TUI messages and behavior', () => {
  let t = null;
  let p = planAction('start', t, { label: 'job apps' }, S, 0);
  assert.equal(p.message(false)[0], 'Focus: 25 min on “job apps” · T for pause / skip / +5 / stop');
  t = p.timer;
  assert.equal(planAction('start', t, null, S, M).message()[0], 'A timer is already running (T for its controls)');
  p = planAction('switch', t, { label: 'essay' }, S, 10 * M);
  assert.equal(p.entry.minutes, 10);
  assert.equal(p.message(true)[0], 'Now focusing on “essay” · logged 10 min to “job apps”');
  t = p.timer;
  p = planAction('skip', t, null, S, 20 * M);
  assert.equal(p.entry.minutes, 10, 'only the time since the switch');
  assert.equal(p.message(true)[0], 'Break: 5 min · logged 10 min of focus');
  assert.equal(planAction('stop', p.timer, null, S, 21 * M).message(false)[0], 'Timer stopped');
  assert.equal(planAction('discard', t, null, S, 0).message()[0], 'Timer discarded (nothing logged)');
  const due = planAction('end', P.startFocus({ label: 'x' }, S, 0), null, S, 25 * M);
  assert.equal(due.timer.status, 'ended');
  assert.equal(due.message()[0], 'Focus 1/4 done — x · T: start the break or +5 min');
});

test('snapshot computes remaining time from timestamps, and sees a due phase as ended', () => {
  updateTimerFile(() => ({ timer: P.startFocus({ label: 'x' }, S, 1_000_000) }));
  const f = readTimerFile();
  const s = snapshot(f, S, 1_000_000 + 5 * M);
  assert.equal(s.remaining_ms, 20 * M);
  assert.equal(s.ends_at, 1_000_000 + 25 * M);
  assert.equal(snapshot(f, S, 1_000_000 + 26 * M).status, 'ended');
  assert.equal(snapshot(f, S, 1_000_000 + 26 * M).remaining_ms, 0);
});

test('`magnus timer` and runAction produce the same file as the TUI keys', async () => {
  await runAction('start', { label: 'office hours: E&M' }, { settings: S, log: noLog, by: 'tui' });
  await runAction('togglePause', null, { settings: S, log: noLog, by: 'tui' });
  const tuiFile = readTimerFile();
  fs.rmSync(path.join(dir, 'magnus'), { recursive: true });
  await cli('start', '--label', 'office hours: E&M');
  await cli('pause');
  const cliFile = readTimerFile();
  const strip = (f) => ({ ...f.timer, startedAt: 0, pausedAt: f.timer.pausedAt ? 1 : null });
  assert.deepEqual(strip(cliFile), strip(tuiFile));
  assert.equal(cliFile.updated_by, 'cli');
  const { stdout } = await cli('status', '--json');
  const snap = JSON.parse(stdout);
  assert.equal(snap.paused, true);
  assert.equal(snap.label, 'office hours: E&M');
});

test('two commands at once both apply, in order (version check, last write wins)', async () => {
  await cli('start', '--label', 'a');
  const before = readTimerFile().version;
  await Promise.all([cli('add5'), cli('add5'), cli('switch', '--label', 'b')]);
  const f = readTimerFile();
  assert.equal(f.version, before + 3);
  assert.equal(f.timer.minutes, 35);
  assert.equal(f.timer.label, 'b');
});

test('the TUI picks up a change made by `magnus timer` within about a second', async () => {
  let latest = null;
  function Probe() {
    const focus = useFocusTimer({ userId: 'demo-user', notify: () => {}, dataChanged: () => {} });
    latest = focus;
    return React.createElement(Text, null, focus.timer ? `${focus.timer.label}|${focus.timer.pausedAt ? 'paused' : 'running'}` : 'none');
  }
  const ui = render(React.createElement(Probe));
  try {
    await latest.start({ label: 'from tui' });
    await new Promise((r) => setTimeout(r, 50));
    assert.match(ui.lastFrame(), /from tui\|running/);
    await cli('pause');
    const t0 = Date.now();
    while (!/paused/.test(ui.lastFrame()) && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 25));
    assert.match(ui.lastFrame(), /from tui\|paused/, 'TUI saw the CLI pause');
    assert.ok(Date.now() - t0 < 1200);
  } finally {
    ui.unmount();
  }
});

test('with no TUI open, an overdue phase is settled before a command, like the TUI tick', async () => {
  const start = Date.now() - 35 * M;
  updateTimerFile(() => ({ timer: P.startFocus({ label: 'x' }, S, start) }));
  await cli('add5');
  const t = readTimerFile().timer;
  assert.equal(t.status, 'running');
  assert.ok(P.remainingMs(t, Date.now()) > 4.5 * M && P.remainingMs(t, Date.now()) <= 5 * M);
  updateTimerFile(() => ({ timer: P.startFocus({ label: 'x' }, S, start) }));
  const { stdout } = await cli('pause');
  assert.match(stdout, /Time's up/);
  assert.equal(readTimerFile().timer.status, 'ended');
  assert.equal(readTimerFile().timer.pausedAt, null);
});

test('migration clears the old prefs copy once timer.json exists', () => {
  fs.mkdirSync(path.join(dir, 'magnus'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'magnus', 'prefs.json'), JSON.stringify({ focusTimer: P.startFocus({ label: 'old' }, S, 0), focusMinutes: 25 }));
  updateTimerFile(() => ({ alerts: 'web' }));
  const prefs = JSON.parse(fs.readFileSync(path.join(dir, 'magnus', 'prefs.json'), 'utf8'));
  assert.equal('focusTimer' in prefs, false);
  assert.equal(readTimerFile().timer.label, 'old');
  fs.rmSync(timerFile());
  assert.equal(readTimerFile().timer, null, 'a deleted timer.json does not resurrect the old timer');
});

test('alerts: no double ringing', () => {
  assert.equal(terminalRings('auto', true), true);
  assert.equal(terminalRings('auto', false), false);
  assert.equal(terminalRings('web', true), false);
  assert.equal(terminalRings('both', false), true);
});
