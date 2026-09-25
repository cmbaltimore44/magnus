import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/lib/pomodoro.js';

const S = P.settingsFrom({});
const M = 60000;

test('a full cycle: focus, short breaks, long break after 4, waiting in between', () => {
  let t = P.startFocus({ id: 'task', title: 'Write' }, S, 0);
  assert.equal(P.phaseLabel(t, S), 'Focus 1/4');
  assert.ok(P.isDue(t, 25 * M));
  t = P.endPhase(t);
  assert.equal(t.status, 'ended');
  assert.equal(P.remainingMs(t, 99 * M), 0); // waiting doesn't count as focus
  let { timer, log } = P.advance(t, S, 30 * M);
  assert.deepEqual(log, { taskId: 'task', label: null, startedAt: 0, minutes: 25 });
  assert.equal(timer.phase, 'short');
  assert.equal(timer.minutes, 5);
  for (let r = 2; r <= 4; r++) {
    ({ timer } = P.advance(P.endPhase(timer), S, 0)); // break → focus
    assert.equal(P.phaseLabel(timer, S), `Focus ${r}/4`);
    ({ timer, log } = P.advance(P.endPhase(timer), S, 25 * M)); // focus → break
  }
  assert.equal(timer.phase, 'long');
  assert.equal(timer.minutes, 15);
  ({ timer } = P.advance(P.endPhase(timer), S, 0));
  assert.equal(P.phaseLabel(timer, S), 'Focus 1/4'); // new cycle
});

test('+5, pause, skip and stop', () => {
  let t = P.endPhase(P.startFocus(null, S, 0));
  t = P.extend(t, 40 * M);
  assert.equal(t.status, 'running');
  assert.equal(P.remainingMs(t, 40 * M), 5 * M);
  assert.equal(P.focusLog(t, 45 * M).minutes, 30);
  // pause
  let r = P.startFocus(null, S, 0);
  r = P.togglePause(r, 10 * M);
  assert.equal(P.remainingMs(r, 50 * M), 15 * M);
  r = P.togglePause(r, 50 * M);
  assert.equal(P.remainingMs(r, 55 * M), 10 * M);
  // skip a focus round after 12 minutes: logs 12, break starts
  const { timer, log } = P.advance(P.startFocus({ id: 'x' }, S, 0), S, 12 * M + 30000);
  assert.equal(log.minutes, 12);
  assert.equal(timer.phase, 'short');
  // skipping a break logs nothing and starts focus
  assert.equal(P.advance(timer, S, 13 * M).log, null);
  // stop under a minute logs nothing
  assert.equal(P.stop(P.startFocus(null, S, 0), 30000), null);
  assert.deepEqual(P.settingsFrom({ focus: '50', short: 'x', every: 0 }), { focus: 50, short: 5, long: 15, every: 4 });
});

import { timerStatus, timerChoices } from '../src/ui/useFocusTimer.js';

test('status line and T menu follow the timer state', () => {
  const t = P.startFocus({ id: 'a', title: 'Essay' }, S, 0);
  assert.equal(timerStatus(t, 60000), '◷ 24:00 Focus 1/4 · Essay');
  assert.deepEqual(timerChoices(t).map((c) => c.key), ['pause', 'switch', 'unassign', 'advance', 'extend', 'stop', 'discard']);
  const ended = P.endPhase(t);
  assert.equal(timerStatus(ended), '⏰ Focus 1/4 done · T');
  assert.deepEqual(timerChoices(ended).map((c) => c.label), ['Start the break', 'Add 5 minutes', 'Switch task…', 'Focus on no task', 'Stop (and log the focus time)']);
  const brk = P.endPhase(P.advance(ended, S, 25 * 60000).timer);
  assert.equal(timerStatus(brk), '⏰ Break over · T');
  assert.equal(timerChoices(brk)[0].label, 'Start the next focus round');
  // No task: nothing to unassign.
  assert.ok(!timerChoices(P.startFocus(null, S, 0)).some((c) => c.key === 'unassign'));
});

test('switching task mid-round logs the old task and keeps the clock and round', () => {
  const A = { id: 'a', title: 'Draft' };
  const B = { id: 'b', title: 'Email' };
  let t = P.startFocus(A, S, 0);
  // 10.5 min in: A gets 10, the leftover 30 s go to B.
  let { timer, log } = P.switchTask(t, B, 10.5 * M);
  assert.deepEqual(log, { taskId: 'a', label: null, startedAt: 0, minutes: 10 });
  assert.equal(timer.title, 'Email');
  assert.equal(P.remainingMs(timer, 10.5 * M), 14.5 * M); // same clock
  assert.equal(P.phaseLabel(timer, S), 'Focus 1/4'); // same round
  // Round ends: B gets the rest (15 min), starting from the switch.
  const next = P.advance(P.endPhase(timer), S, 25 * M);
  assert.deepEqual(next.log, { taskId: 'b', label: null, startedAt: 10.5 * M, minutes: 15 });
  assert.equal(next.timer.phase, 'short');

  // A switch under a minute in logs nothing; all the time goes to the new task.
  ({ timer, log } = P.switchTask(P.startFocus(A, S, 0), B, 0.5 * M));
  assert.equal(log, null);
  assert.equal(P.stop(timer, 25 * M).minutes, 25);

  // Paused time still doesn't count after a switch.
  t = P.togglePause(P.startFocus(A, S, 0), 5 * M); // paused at 5
  ({ timer, log } = P.switchTask(t, B, 9 * M));
  assert.equal(log.minutes, 5);
  timer = P.togglePause(timer, 20 * M); // resumed at 20
  assert.equal(P.stop(timer, 30 * M).minutes, 10);

  // In a break, or after a round ends and waits: only the next round's task changes.
  const brk = P.advance(P.endPhase(P.startFocus(A, S, 0)), S, 25 * M).timer;
  ({ timer, log } = P.switchTask(brk, B, 27 * M));
  assert.equal(log, null);
  assert.equal(P.advance(P.endPhase(timer), S, 30 * M).timer.title, 'Email');
  const waiting = P.endPhase(P.startFocus(A, S, 0));
  ({ timer, log } = P.switchTask(waiting, null, 40 * M));
  assert.deepEqual(log, { taskId: 'a', label: null, startedAt: 0, minutes: 25 }); // the finished round is A's
  const after = P.advance(timer, S, 41 * M);
  assert.equal(after.log, null); // not logged twice
  assert.equal(after.timer.phase, 'short');
  assert.equal(P.advance(P.endPhase(after.timer), S, 50 * M).timer.taskId, null);
});

import { focusChoices, typedChoice } from '../src/lib/focusPicker.js';
import { recentLabels } from '../src/lib/data/focus.js';

test('focusing on a label instead of a task', () => {
  let t = P.startFocus({ label: '  job apps ' }, S, 0);
  assert.equal(t.title, 'job apps');
  assert.equal(t.taskId, null);
  assert.equal(timerStatus(t, M), '◷ 24:00 Focus 1/4 · job apps');
  // Mid-round switch from the label to a task: the label gets its minutes.
  let { timer, log } = P.switchTask(t, { id: 'a', title: 'Draft' }, 12 * M);
  assert.deepEqual(log, { taskId: null, label: 'job apps', startedAt: 0, minutes: 12 });
  assert.equal(timer.label, null);
  assert.equal(timer.title, 'Draft');
  // ...and back: the label carries on into the next round.
  ({ timer } = P.switchTask(timer, { label: 'Essay: On Attention' }, 20 * M));
  const brk = P.advance(P.endPhase(timer), S, 25 * M);
  assert.equal(brk.log.label, 'Essay: On Attention');
  assert.equal(brk.log.minutes, 5);
  assert.equal(P.advance(P.endPhase(brk.timer), S, 30 * M).timer.title, 'Essay: On Attention');
  assert.ok(P.sameTarget(timer, { label: 'Essay: On Attention' }));
  assert.ok(!P.sameTarget(timer, { label: 'job apps' }));
  assert.ok(P.sameTarget(P.startFocus(null, S, 0), null));
  assert.ok(!P.sameTarget(P.startFocus(null, S, 0), { label: 'x' }));
  // A timer saved before labels existed still works.
  const old = { taskId: null, title: null, phase: 'focus', round: 0, startedAt: 0, minutes: 25, pausedAt: null, pausedMs: 0, status: 'running' };
  assert.deepEqual(P.stop(old, 10 * M), { taskId: null, label: null, startedAt: 0, minutes: 10 });
  assert.ok(P.sameTarget(old, null));
  assert.ok(timerChoices(P.startFocus({ label: 'x' }, S, 0)).some((c) => c.key === 'unassign'));
});

test('focus picker: tasks, recent labels, essays and notes, typed text', () => {
  const tasks = [
    { id: '1', title: 'Fix faucet', due_date: '2026-09-30' },
    { id: '2', title: 'Draft Q4', is_starred: true, due_date: '2026-09-26' },
  ];
  const labels = recentLabels([
    { label: 'job apps', started_at: '2026-09-20T10:00:00Z' },
    { label: 'Job Apps', started_at: '2026-09-24T10:00:00Z' },
    { label: null, started_at: '2026-09-25T10:00:00Z' },
    { label: 'Essay: On Attention', started_at: '2026-09-22T10:00:00Z' },
  ]);
  assert.deepEqual(labels, ['Job Apps', 'Essay: On Attention']);
  const entries = [
    { type: 'essay', title: 'On Attention' },
    { type: 'daily', title: '2026-09-25' },
    { type: 'note', title: 'Pricing ideas' },
  ];
  const idle = focusChoices({ tasks, labels, entries });
  assert.deepEqual(idle.map((c) => `${c.group}|${c.label}`), [
    'Start|Just start (nothing in particular)',
    '★|Draft Q4',
    'Recent|Job Apps',
    'Recent|Essay: On Attention',
    'Task|Fix faucet',
    'Note|Note: Pricing ideas', // the essay is already in Recent
  ]);
  assert.equal(idle[0].to, null);
  assert.deepEqual(idle[2].to, { label: 'Job Apps' });
  assert.deepEqual(idle[1].to, { id: '2', title: 'Draft Q4' });
  // While focusing on a label: it's marked Now, and "no task" is offered.
  const running = focusChoices({ tasks, labels, entries, timer: P.startFocus({ label: 'job apps' }, S, 0) });
  assert.equal(running[0].label, 'Focus on no task');
  assert.equal(running.find((c) => c.label === 'Job Apps').group, 'Now');
  // Typed text becomes a new label, unless it's already a choice.
  assert.deepEqual(typedChoice('  cover letters ', idle).to, { label: 'cover letters' });
  assert.equal(typedChoice('job apps', idle), null);
  assert.equal(typedChoice('   ', idle), null);
});
