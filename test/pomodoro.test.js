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
  assert.deepEqual(log, { taskId: 'task', startedAt: 0, minutes: 25 });
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
  assert.deepEqual(timerChoices(t).map((c) => c.key), ['pause', 'advance', 'extend', 'stop', 'discard']);
  const ended = P.endPhase(t);
  assert.equal(timerStatus(ended), '⏰ Focus 1/4 done · T');
  assert.deepEqual(timerChoices(ended).map((c) => c.label), ['Start the break', 'Add 5 minutes', 'Stop (and log the focus time)']);
  const brk = P.endPhase(P.advance(ended, S, 25 * 60000).timer);
  assert.equal(timerStatus(brk), '⏰ Break over · T');
  assert.equal(timerChoices(brk)[0].label, 'Start the next focus round');
});
