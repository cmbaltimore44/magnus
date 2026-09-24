import { useCallback, useEffect, useRef, useState } from 'react';
import { getPref, setPref } from '../lib/prefs.js';
import * as focusApi from '../lib/data/focus.js';
import { isMissingSchema } from '../lib/data/logs.js';

// One focus timer at a time, on a task. It survives quitting Magnus (kept in
// prefs.json); a timer that ran out while Magnus was closed is logged in full
// on the next launch. A run is logged to focus_sessions when it finishes or
// is stopped after at least a minute.
//   timer: { taskId, title, startedAt, minutes, pausedAt?, pausedMs }
export function focusElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const end = timer.pausedAt ?? now;
  return Math.max(0, end - timer.startedAt - (timer.pausedMs || 0));
}

export function useFocusTimer({ userId, notify, dataChanged }) {
  const [timer, setTimerState] = useState(() => getPref('focusTimer', null));
  const [, setTick] = useState(0);
  const timerRef = useRef(timer);

  const setTimer = useCallback((t) => {
    timerRef.current = t;
    setTimerState(t);
    setPref('focusTimer', t);
  }, []);

  const log = useCallback(
    async (t, minutes) => {
      if (minutes < 1) return notify('Focus stopped (under a minute, not logged)', 'info');
      try {
        await focusApi.createFocusSession(userId, t.taskId, t.startedAt, minutes);
        dataChanged();
        return true;
      } catch (err) {
        notify(isMissingSchema(err) ? 'Focus not logged: run supabase/schema_003.sql first' : `Focus not logged: ${err.message}`, 'error');
        return false;
      }
    },
    [userId, notify, dataChanged]
  );

  // Tick once a second while running; finish when time's up.
  useEffect(() => {
    if (!timer || !userId) return undefined;
    const check = () => {
      const t = timerRef.current;
      if (!t) return;
      if (!t.pausedAt && focusElapsedMs(t) >= t.minutes * 60000) {
        setTimer(null);
        process.stdout.write('\x07');
        log(t, t.minutes).then((ok) => ok && notify(`Focus done: ${t.minutes} min on “${t.title}” — logged`, 'success'));
      } else {
        setTick((n) => n + 1);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [timer, userId, setTimer, log, notify]);

  const start = useCallback(
    async (task, minutes = getPref('focusMinutes', 25)) => {
      if (timerRef.current) return notify('A focus timer is already running (T to stop it)', 'error');
      setTimer({ taskId: task.id, title: task.title, startedAt: Date.now(), minutes, pausedAt: null, pausedMs: 0 });
      let sofar = '';
      try {
        const total = await focusApi.focusMinutesForTask(task.id);
        if (total) sofar = ` · ${total} min so far`;
      } catch {
        // no schema_003 yet — the timer still runs
      }
      notify(`Focus: ${minutes} min on “${task.title}”${sofar} · T to pause/stop`, 'success');
    },
    [notify, setTimer]
  );

  const togglePause = useCallback(() => {
    const t = timerRef.current;
    if (!t) return;
    if (t.pausedAt) setTimer({ ...t, pausedMs: (t.pausedMs || 0) + (Date.now() - t.pausedAt), pausedAt: null });
    else setTimer({ ...t, pausedAt: Date.now() });
  }, [setTimer]);

  const stop = useCallback(async () => {
    const t = timerRef.current;
    if (!t) return;
    setTimer(null);
    const minutes = Math.floor(focusElapsedMs(t) / 60000);
    if (await log(t, minutes)) notify(`Focus stopped: ${minutes} min on “${t.title}” — logged`, 'success');
  }, [setTimer, log, notify]);

  const discard = useCallback(() => {
    if (!timerRef.current) return;
    setTimer(null);
    notify('Focus timer discarded', 'info');
  }, [setTimer, notify]);

  return { timer, start, togglePause, stop, discard };
}

export function formatRemaining(timer, now = Date.now()) {
  const left = Math.max(0, timer.minutes * 60000 - focusElapsedMs(timer, now));
  const s = Math.ceil(left / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
