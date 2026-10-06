import { useCallback, useEffect, useRef, useState } from 'react';
import { execFile } from 'node:child_process';
import { getPref } from '../lib/prefs.js';
import * as focusApi from '../lib/data/focus.js';
import { isMissingSchema } from '../lib/data/logs.js';
import * as P from '../lib/pomodoro.js';
import { migrate, nextName, runAction } from '../lib/timerActions.js';
import { clearHeartbeat, readTimerFile, syncSettings, terminalRings, watchTimerFile, writeHeartbeat } from '../lib/timerStore.js';

// Pomodoro timer (lib/pomodoro.js has the rules, lib/timerActions.js the
// actions): one at a time, optionally on a task. It lives in
// ~/.config/magnus/timer.json, shared with `magnus timer …` and Magnus Tutor,
// so it survives quitting Magnus and changes made elsewhere show up here
// within a second. When a phase is up it rings (unless alerts go to the
// web app), posts a macOS notification and waits for you: start the next
// phase or add 5 minutes. Focus minutes are logged to focus_sessions when you
// leave a focus phase, or switch task in the middle of one.

export function pomodoroSettings() {
  return P.settingsFrom({
    focus: getPref('focusMinutes', 25),
    short: getPref('breakMinutes', 5),
    long: getPref('longBreakMinutes', 15),
    every: getPref('longBreakEvery', 4),
  });
}

function notifyMac(title, body) {
  if (process.platform !== 'darwin' || process.env.MAGNUS_DEMO) return;
  const q = (s) => `"${String(s).replace(/[\\"]/g, '\\$&')}"`;
  execFile('osascript', ['-e', `display notification ${q(body)} with title ${q(title)} sound name "Glass"`], () => {});
}

/** Log a focus entry to focus_sessions; notify on failure. Shared with `magnus timer`. */
export async function logFocus(userId, entry, notify) {
  if (!entry) return false;
  try {
    const row = await focusApi.createFocusSession(userId, entry.taskId, entry.startedAt, entry.minutes, entry.label);
    if (row?.labelDropped) notify(`Focus logged without its label “${entry.label}”: run supabase/schema_005.sql to keep labels`, 'error');
    return true;
  } catch (err) {
    notify(isMissingSchema(err) ? 'Focus not logged: run supabase/schema_003.sql first' : `Focus not logged: ${err.message}`, 'error');
    return false;
  }
}

export function useFocusTimer({ userId, notify, dataChanged }) {
  const [file, setFile] = useState(() => readTimerFile());
  const timer = migrate(file.timer);
  const [, setTick] = useState(0);
  const fileRef = useRef(file);
  fileRef.current = file;

  const log = useCallback(
    async (entry) => {
      const ok = await logFocus(userId, entry, notify);
      if (ok) dataChanged();
      return ok;
    },
    [userId, notify, dataChanged]
  );

  // Changes made by `magnus timer` or the tutor web app (via magnus timer).
  useEffect(() => {
    syncSettings(pomodoroSettings());
    const reload = () => {
      const next = readTimerFile();
      if (next.version !== fileRef.current.version) setFile(next);
    };
    return watchTimerFile(reload);
  }, []);

  // Tell the tutor web app the terminal is open (for alerts: no double ringing).
  useEffect(() => {
    writeHeartbeat();
    const id = setInterval(writeHeartbeat, 15000);
    return () => {
      clearInterval(id);
      clearHeartbeat();
    };
  }, []);

  const act = useCallback(
    async (name, to = null) => {
      const r = await runAction(name, to, { settings: pomodoroSettings(), log, by: 'tui' });
      setFile(r.file);
      return r;
    },
    [log]
  );

  // Tick once a second; when time's up, ring and wait.
  useEffect(() => {
    if (!timer || !userId) return undefined;
    const check = async () => {
      const t = migrate(fileRef.current.timer);
      if (!t) return;
      if (P.isDue(t, Date.now())) {
        const r = await act('end');
        if (!r.plan.change) return;
        const { what, next } = r.plan.ended;
        if (terminalRings(r.file.alerts, true)) {
          process.stdout.write('\x07');
          notifyMac('Magnus', `${what}. Start the ${next}, or add 5 minutes.`);
        }
        notify(`${what} · T: start the ${next} or +5 min`, 'success', 15000);
      } else {
        setTick((n) => n + 1);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [timer, userId, act, notify]);

  const say = useCallback((r) => r.message && notify(r.message[0], r.message[1]), [notify]);

  // Keep the clock and round, change what it's on: a task { id, title },
  // a label { label }, or null for nothing.
  const switchTo = useCallback(async (to = null) => say(await act('switch', to)), [act, say]);

  const start = useCallback(
    async (to = null) => {
      // t on a task while a timer runs switches the timer to it.
      const r = await act('start', to);
      if (r.plan.change && to?.id && r.message?.[0].startsWith('Focus:')) {
        let sofar = '';
        try {
          const total = await focusApi.focusMinutesForTask(to.id);
          if (total) sofar = ` · ${total} min so far`;
        } catch {
          // no schema_003 yet: the timer still runs
        }
        return notify(...r.plan.message(false, sofar));
      }
      say(r);
    },
    [act, say, notify]
  );

  const togglePause = useCallback(() => act('togglePause'), [act]);
  const extend = useCallback(() => act('extend'), [act]);
  // Next phase (after one ends) or skip (during one): same move.
  const advance = useCallback(async () => say(await act('advance')), [act, say]);
  const stop = useCallback(async () => say(await act('stop')), [act, say]);
  const discard = useCallback(async () => say(await act('discard')), [act, say]);

  return { timer, start, switchTo, togglePause, extend, advance, stop, discard };
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
      ...switchChoices(t),
      { key: 'stop', label: t.phase === 'focus' ? 'Stop (and log the focus time)' : 'Stop' },
    ];
  }
  return [
    { key: 'pause', label: t.pausedAt ? 'Resume' : 'Pause' },
    ...switchChoices(t),
    { key: 'advance', label: `Skip to the ${next}${t.phase === 'focus' ? ' (logs the time so far)' : ''}` },
    { key: 'extend', label: 'Add 5 minutes' },
    { key: 'stop', label: t.phase === 'focus' ? 'Stop and log the time so far' : 'Stop' },
    { key: 'discard', label: 'Discard (log nothing)' },
  ];
}

function switchChoices(t) {
  const during = t.phase === 'focus' && t.status === 'running';
  return [
    { key: 'switch', label: during ? 'Switch task… (logs the time so far to this one)' : 'Switch task…' },
    ...(t.taskId || t.label ? [{ key: 'unassign', label: during ? 'Focus on no task (logs the time so far)' : 'Focus on no task' }] : []),
  ];
}
