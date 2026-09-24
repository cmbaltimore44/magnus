import { useCallback, useEffect, useRef, useState } from 'react';
import { execFile } from 'node:child_process';
import { getPref, setPref } from '../lib/prefs.js';
import * as focusApi from '../lib/data/focus.js';
import { isMissingSchema } from '../lib/data/logs.js';
import * as P from '../lib/pomodoro.js';

// Pomodoro timer (lib/pomodoro.js has the rules): one at a time, optionally
// on a task. It survives quitting Magnus (prefs.json). When a phase is up it
// rings, posts a macOS notification and waits for you: start the next phase
// or add 5 minutes. Focus minutes are logged to focus_sessions when you
// leave a focus phase.

const nextName = (phase) => (phase === 'focus' ? 'next focus round' : P.PHASE_LABELS[phase].toLowerCase());

export function pomodoroSettings() {
  return P.settingsFrom({
    focus: getPref('focusMinutes', 25),
    short: getPref('breakMinutes', 5),
    long: getPref('longBreakMinutes', 15),
    every: getPref('longBreakEvery', 4),
  });
}

// A timer saved by the older, single-countdown version: keep it running as round 1.
function migrate(t) {
  if (!t || t.phase) return t;
  return { ...t, phase: 'focus', round: 0, status: 'running' };
}

function notifyMac(title, body) {
  if (process.platform !== 'darwin' || process.env.MAGNUS_DEMO) return;
  const q = (s) => `"${String(s).replace(/[\\"]/g, '\\$&')}"`;
  execFile('osascript', ['-e', `display notification ${q(body)} with title ${q(title)} sound name "Glass"`], () => {});
}

export function useFocusTimer({ userId, notify, dataChanged }) {
  const [timer, setTimerState] = useState(() => migrate(getPref('focusTimer', null)));
  const [, setTick] = useState(0);
  const timerRef = useRef(timer);

  const setTimer = useCallback((t) => {
    timerRef.current = t;
    setTimerState(t);
    setPref('focusTimer', t);
  }, []);

  const log = useCallback(
    async (entry) => {
      if (!entry) return false;
      try {
        await focusApi.createFocusSession(userId, entry.taskId, entry.startedAt, entry.minutes);
        dataChanged();
        return true;
      } catch (err) {
        notify(isMissingSchema(err) ? 'Focus not logged: run supabase/schema_003.sql first' : `Focus not logged: ${err.message}`, 'error');
        return false;
      }
    },
    [userId, notify, dataChanged]
  );

  // Tick once a second; when time's up, ring and wait.
  useEffect(() => {
    if (!timer || !userId) return undefined;
    const check = () => {
      const t = timerRef.current;
      if (!t) return;
      if (P.isDue(t, Date.now())) {
        const s = pomodoroSettings();
        const next = nextName(P.nextPhaseOf(t, s).phase);
        const what = t.phase === 'focus' ? `${P.phaseLabel(t, s)} done${t.title ? ` — ${t.title}` : ''}` : `${P.PHASE_LABELS[t.phase]} over`;
        setTimer(P.endPhase(t));
        process.stdout.write('\x07');
        notifyMac('Magnus', `${what}. Start the ${next}, or add 5 minutes.`);
        notify(`${what} · T: start the ${next} or +5 min`, 'success', 15000);
      } else {
        setTick((n) => n + 1);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [timer, userId, setTimer, notify]);

  const start = useCallback(
    async (task = null) => {
      if (timerRef.current) return notify('A timer is already running (T for its controls)', 'error');
      const s = pomodoroSettings();
      setTimer(P.startFocus(task, s, Date.now()));
      let sofar = '';
      if (task) {
        try {
          const total = await focusApi.focusMinutesForTask(task.id);
          if (total) sofar = ` · ${total} min so far`;
        } catch {
          // no schema_003 yet: the timer still runs
        }
      }
      notify(`Focus: ${s.focus} min${task ? ` on “${task.title}”` : ''}${sofar} · T for pause / skip / +5 / stop`, 'success');
    },
    [notify, setTimer]
  );

  const togglePause = useCallback(() => {
    const t = timerRef.current;
    if (t) setTimer(P.togglePause(t, Date.now()));
  }, [setTimer]);

  const extend = useCallback(() => {
    const t = timerRef.current;
    if (t) setTimer(P.extend(t, Date.now(), 5));
  }, [setTimer]);

  // Next phase (after one ends) or skip (during one): same move.
  const advance = useCallback(async () => {
    const t = timerRef.current;
    if (!t) return;
    const { timer: next, log: entry } = P.advance(t, pomodoroSettings(), Date.now());
    setTimer(next);
    const logged = await log(entry);
    const s = pomodoroSettings();
    notify(`${P.phaseLabel(next, s)}: ${next.minutes} min${logged ? ` · logged ${entry.minutes} min of focus` : ''}`, 'success');
  }, [setTimer, log, notify]);

  const stop = useCallback(async () => {
    const t = timerRef.current;
    if (!t) return;
    setTimer(null);
    const entry = P.stop(t, Date.now());
    if (await log(entry)) notify(`Timer stopped · logged ${entry.minutes} min of focus`, 'success');
    else if (!entry) notify('Timer stopped', 'info');
  }, [setTimer, log, notify]);

  const discard = useCallback(() => {
    if (!timerRef.current) return;
    setTimer(null);
    notify('Timer discarded (nothing logged)', 'info');
  }, [setTimer, notify]);

  return { timer, start, togglePause, extend, advance, stop, discard };
}

// Status bar text, e.g. "◷ 18:24 Focus 2/4 · Draft Q4" or "⏰ Break over — T".
export function timerStatus(t, now = Date.now()) {
  const s = pomodoroSettings();
  const label = P.phaseLabel(t, s);
  if (t.status === 'ended') return `⏰ ${t.phase === 'focus' ? `${label} done` : `${label} over`} · T`;
  const icon = t.pausedAt ? '⏸' : t.phase === 'focus' ? '◷' : '☕';
  return `${icon} ${P.formatClock(P.remainingMs(t, now))} ${label}${t.title ? ` · ${t.title}` : ''}`;
}

// The T menu's choices for the timer's state.
export function timerChoices(t) {
  const next = nextName(P.nextPhaseOf(t, pomodoroSettings()).phase);
  if (t.status === 'ended') {
    return [
      { key: 'advance', label: `Start the ${next}` },
      { key: 'extend', label: 'Add 5 minutes' },
      { key: 'stop', label: t.phase === 'focus' ? 'Stop (and log the focus time)' : 'Stop' },
    ];
  }
  return [
    { key: 'pause', label: t.pausedAt ? 'Resume' : 'Pause' },
    { key: 'advance', label: `Skip to the ${next}${t.phase === 'focus' ? ' (logs the time so far)' : ''}` },
    { key: 'extend', label: 'Add 5 minutes' },
    { key: 'stop', label: t.phase === 'focus' ? 'Stop and log the time so far' : 'Stop' },
    { key: 'discard', label: 'Discard (log nothing)' },
  ];
}
