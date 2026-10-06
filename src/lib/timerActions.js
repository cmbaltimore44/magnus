// Focus timer actions shared by the TUI keys (t / T) and `magnus timer …`, so
// both behave identically: same state changes, same focus logging, same messages.
// planAction is pure; runAction applies it to timer.json and logs focus time.
import * as P from './pomodoro.js';
import { updateTimerFile } from './timerStore.js';

export const ACTIONS = ['start', 'switch', 'pause', 'resume', 'togglePause', 'skip', 'advance', 'add5', 'extend', 'stop', 'discard', 'end'];

// “Draft Q4” / “job apps”, or "no task".
export const named = (title) => (title ? `“${title}”` : 'no task');
const titleOf = (to) => (to?.id ? to.title : to?.label) || null;
export const nextName = (phase) => (phase === 'focus' ? 'next focus round' : P.PHASE_LABELS[phase].toLowerCase());

/**
 * What an action does to timer `t` (may be null). `to` is a target for start /
 * switch: a task { id, title }, a label { label }, or null.
 * Returns { change: bool, timer, entry, message(logged) → [text, level] | null }.
 */
export function planAction(name, t, to, settings, now) {
  const none = (text, level = 'info') => ({ change: false, timer: t, entry: null, message: () => [text, level] });
  switch (name) {
    case 'start': {
      if (t) return to ? planAction('switch', t, to, settings, now) : none('A timer is already running (T for its controls)', 'error');
      const timer = P.startFocus(to, settings, now);
      return {
        change: true,
        timer,
        entry: null,
        message: (_, extra = '') => [`Focus: ${settings.focus} min${timer.title ? ` on ${named(timer.title)}` : ''}${extra} · T for pause / skip / +5 / stop`, 'success'],
      };
    }
    case 'switch': {
      if (!t) return none('No timer running');
      if (P.sameTarget(t, to)) return none(to ? `Already focusing on ${named(titleOf(to))}` : 'Not focusing on anything in particular already');
      const { timer, log: entry } = P.switchTask(t, to, now);
      const when = t.phase === 'focus' && t.status === 'running' ? 'Now focusing on' : 'Next focus round: on';
      return { change: true, timer, entry, message: (logged) => [`${when} ${named(timer.title)}${logged ? ` · logged ${entry.minutes} min to ${named(t.title)}` : ''}`, 'success'] };
    }
    case 'pause':
      if (!t || t.status !== 'running' || t.pausedAt) return none(t ? 'Already paused' : 'No timer running');
      return { change: true, timer: P.togglePause(t, now), entry: null, message: () => null };
    case 'resume':
      if (!t || !t.pausedAt) return none(t ? 'Not paused' : 'No timer running');
      return { change: true, timer: P.togglePause(t, now), entry: null, message: () => null };
    case 'togglePause':
      if (!t) return none('No timer running');
      return { change: true, timer: P.togglePause(t, now), entry: null, message: () => null };
    case 'add5':
    case 'extend':
      if (!t) return none('No timer running');
      return { change: true, timer: P.extend(t, now, 5), entry: null, message: () => null };
    case 'skip':
    case 'advance': {
      if (!t) return none('No timer running');
      const { timer, log: entry } = P.advance(t, settings, now);
      return { change: true, timer, entry, message: (logged) => [`${P.phaseLabel(timer, settings)}: ${timer.minutes} min${logged ? ` · logged ${entry.minutes} min of focus` : ''}`, 'success'] };
    }
    case 'stop': {
      if (!t) return none('No timer running');
      const entry = P.stop(t, now);
      return { change: true, timer: null, entry, message: (logged) => (logged ? [`Timer stopped · logged ${entry.minutes} min of focus`, 'success'] : entry ? null : ['Timer stopped', 'info']) };
    }
    case 'discard':
      if (!t) return none('No timer running');
      return { change: true, timer: null, entry: null, message: () => ['Timer discarded (nothing logged)', 'info'] };
    case 'end': {
      // Time's up on a running phase (the TUI's tick, or a CLI command noticing it).
      if (!P.isDue(t, now)) return none('');
      const next = nextName(P.nextPhaseOf(t, settings).phase);
      const what = t.phase === 'focus' ? `${P.phaseLabel(t, settings)} done${t.title ? ` — ${t.title}` : ''}` : `${P.PHASE_LABELS[t.phase]} over`;
      return { change: true, timer: P.endPhase(t), entry: null, ended: { what, next }, message: () => [`${what} · T: start the ${next} or +5 min`, 'success'] };
    }
    default:
      throw new Error(`unknown timer action ${name}`);
  }
}

/**
 * Apply an action to timer.json, then log the focus entry (if any) with
 * `log(entry) → Promise<bool>`. Returns { file, plan, logged, message }.
 */
export async function runAction(name, to, { settings, log, by = 'tui', now = Date.now() }) {
  let plan;
  const file = updateTimerFile((cur) => {
    const t = migrate(cur.timer);
    plan = planAction(name, t, to, settings, now);
    return plan.change ? { timer: plan.timer, settings } : undefined;
  }, by);
  const logged = plan.entry ? await log(plan.entry) : false;
  return { file, plan, logged, message: plan.message(logged) };
}

export function migrate(t) {
  if (!t || t.phase) return t;
  return { ...t, phase: 'focus', round: 0, status: 'running' };
}

/** The snapshot `magnus timer status --json` prints (see the contract). */
export function snapshot(file, settings, now = Date.now(), extra = {}) {
  const t = migrate(file.timer);
  const s = settings || file.settings;
  if (!t) return { active: false, version: file.version, alerts: file.alerts, every: s.every, ...extra };
  const due = P.isDue(t, now);
  const status = due ? 'ended' : t.status;
  const remaining = status === 'ended' ? 0 : P.remainingMs(t, now);
  return {
    active: true,
    phase: t.phase,
    status,
    paused: !!t.pausedAt,
    remaining_ms: remaining,
    ends_at: status === 'running' && !t.pausedAt ? now + remaining : null,
    phase_label: P.phaseLabel(t, s),
    round: t.round,
    every: s.every,
    minutes: t.minutes,
    started_at: t.startedAt,
    title: t.title ?? null,
    label: t.label ?? null,
    task_id: t.taskId ?? null,
    version: file.version,
    alerts: file.alerts,
    ...extra,
  };
}
