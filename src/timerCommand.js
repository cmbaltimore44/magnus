// `magnus timer …`: control the focus timer from scripts and Magnus Tutor.
// Same code path as the TUI keys (lib/timerActions.js), including logging to
// focus_sessions, and works whether or not the TUI is running. The contract
// is in magnus-tutor/docs/timer-contract.md.
import { restoreSession, currentUserId } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import * as focusApi from './lib/data/focus.js';
import { runAction, snapshot } from './lib/timerActions.js';
import { readTimerFile, setAlerts, tuiAlive } from './lib/timerStore.js';
import { logFocus, pomodoroSettings } from './ui/useFocusTimer.js';

export const TIMER_HELP = `magnus timer — the focus timer (shared with the TUI and Magnus Tutor)

  magnus timer status [--json]
  magnus timer start [--task ID | --label "text"]   (switches if a timer is running and a target is given)
  magnus timer pause | resume | skip | add5 | stop | discard
  magnus timer switch [--task ID | --label "text" | --none]
  magnus timer alerts auto|terminal|web|both
  magnus timer minutes [--label PREFIX] [--days N] [--json]
Add --json to any command to print the timer snapshot afterwards.
`;

const COMMANDS = { start: 'start', pause: 'pause', resume: 'resume', skip: 'skip', add5: 'add5', stop: 'stop', discard: 'discard', switch: 'switch' };

function flags(args) {
  const out = { json: false, none: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') out.json = true;
    else if (a === '--none') out.none = true;
    else if (['--task', '--label', '--days'].includes(a)) {
      if (i + 1 >= args.length) throw new Error(`${a} needs a value`);
      out[a.slice(2)] = args[++i];
    } else throw new Error(`unknown option ${a}`);
  }
  return out;
}

let sessionPromise = null;
async function userId() {
  sessionPromise ||= restoreSession();
  const { session } = await sessionPromise;
  return currentUserId(session);
}

async function target(f) {
  if (f.none) return null;
  if (f.task) {
    let title = null;
    try {
      const { data } = await supabase.from('tasks').select('title').eq('id', f.task).single();
      title = data?.title ?? null;
    } catch {
      // offline and not cached: keep the id
    }
    return { id: f.task, title: title || 'task' };
  }
  if (f.label) return { label: f.label };
  return null;
}

function print(f, file, extra = {}) {
  const snap = snapshot(file, pomodoroSettings(), Date.now(), { tui_alive: tuiAlive(), ...extra });
  if (f.json) process.stdout.write(JSON.stringify(snap) + '\n');
  return snap;
}

export async function runTimer(args) {
  const [cmd = 'status', ...rest] = args;
  if (cmd === '--help' || cmd === 'help') {
    process.stdout.write(TIMER_HELP);
    return 0;
  }
  if (cmd === 'alerts') {
    const mode = rest.find((a) => !a.startsWith('--'));
    const file = setAlerts(mode, 'cli');
    if (!rest.includes('--json')) process.stdout.write(`Alerts: ${file.alerts}\n`);
    print({ json: rest.includes('--json') }, file);
    return 0;
  }
  const f = flags(rest);
  if (cmd === 'status') {
    const snap = print(f, readTimerFile());
    if (!f.json) process.stdout.write(statusLine(snap) + '\n');
    return 0;
  }
  if (cmd === 'minutes') {
    const days = Number(f.days || 30);
    await userId();
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await focusApi.listFocusSessions(since);
    const prefix = (f.label || '').trim().toLowerCase();
    const hits = rows.filter((r) => !prefix || (r.label || '').toLowerCase().startsWith(prefix));
    const byLabel = {};
    for (const r of hits) byLabel[r.label || '(task)'] = (byLabel[r.label || '(task)'] || 0) + r.minutes;
    const out = { minutes: hits.reduce((n, r) => n + r.minutes, 0), sessions: hits.length, days, by_label: byLabel, ranges: hits.map((r) => ({ started_at: r.started_at, minutes: r.minutes, label: r.label })) };
    process.stdout.write(f.json ? JSON.stringify(out) + '\n' : `${out.minutes} min in ${out.sessions} sessions (last ${days} days)\n`);
    return 0;
  }
  const action = COMMANDS[cmd];
  if (!action) throw new Error(`unknown timer command "${cmd}" (see magnus timer --help)`);
  const to = await target(f);
  const messages = [];
  const notify = (text, level) => messages.push([text, level]);
  const r = await runAction(action, to, {
    settings: pomodoroSettings(),
    by: 'cli',
    log: async (entry) => logFocus(await userId(), entry, notify),
  });
  if (r.message) messages.push(r.message);
  print(f, r.file, { logged: r.logged && r.plan.entry ? { minutes: r.plan.entry.minutes } : null, message: messages.map((m) => m[0]).join(' · ') || null });
  if (!f.json) for (const [text] of messages) process.stdout.write(text + '\n');
  const failed = messages.some(([, level]) => level === 'error');
  return failed && !r.plan.change ? 1 : 0;
}

function clock(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function statusLine(s) {
  if (!s.active) return 'No timer running';
  if (s.status === 'ended') return `⏰ ${s.phase_label} ${s.phase === 'focus' ? 'done' : 'over'}${s.title ? ` · ${s.title}` : ''}`;
  return `${s.paused ? '⏸' : s.phase === 'focus' ? '◷' : '☕'} ${clock(s.remaining_ms)} ${s.phase_label}${s.title ? ` · ${s.title}` : ''}`;
}
