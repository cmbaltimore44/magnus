// Planning sessions: "Plan my week" and "Pick my three" are Ask questions
// with the relevant data attached (so even the local model starts from the
// facts, not from a dozen lookups). Their changes go through the same
// keep/drop checklist and undo; an accepted week plan is saved into the
// week's review with `jweek --plan` (Markdown only: nothing reads the journal).
import { todayISO, addDays } from '../data/completions.js';
import { isoWeek } from '../stats.js';
import { runCapture } from '../shell.js';

// A plan makes many small changes (one update_task each), so it gets more
// steps than a question; still bounded.
export const PLAN_STEPS = 16;

const day = (iso, opts = { weekday: 'short' }) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts);
const short = (iso) => day(iso, { month: 'short', day: 'numeric' });

/**
 * What "my week" means today: Friday to Sunday, next Monday–Sunday; Monday
 * to Thursday, the rest of this week. Either way the plan is saved with this
 * week's review (jweek keeps it pending until the review is written).
 */
export function planWindow(today = todayISO()) {
  const dow = new Date(today + 'T00:00:00').getDay(); // 0 = Sunday
  const nextWeek = dow === 0 || dow >= 5;
  const start = nextWeek ? addDays(today, (8 - dow) % 7) : today;
  const end = nextWeek ? addDays(start, 6) : addDays(today, (7 - dow) % 7);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start, end, days, nextWeek, label: nextWeek ? 'next week' : 'the rest of this week', review: isoWeek(today) };
}

async function lookup(toolbox, name, args = {}) {
  return (await toolbox.run(name, args)).result; // JSON text; registers task refs
}

export async function weekQuestion(toolbox, today = todayISO()) {
  const win = planWindow(today);
  const [tasks, projects, goals] = await Promise.all([lookup(toolbox, 'find_tasks', {}), lookup(toolbox, 'projects'), lookup(toolbox, 'lists', { name: 'goals' })]);
  const text = [
    `Plan ${win.label}: ${win.days.map((d) => `${day(d)} ${d}`).join(', ')}.`,
    '',
    `Open tasks (refs for update_task): ${tasks}`,
    `Projects: ${projects}`,
    `Goals list: ${goals}`,
    '',
    'Make a realistic plan with update_task calls:',
    `- Give each task that belongs in this window a due date on one of those days. At most 4 tasks a day; overdue and high-priority first, then work toward the goals and project targets.`,
    '- Leave tasks that already repeat (they have "repeats") on their dates.',
    `- Low-priority tasks that won't fit: move them to after ${short(win.end)}.`,
    `- Star the three most important tasks for ${day(win.start, { weekday: 'long' })} (unstar other starred tasks first: at most 3 can be starred).`,
    'Then answer with one short line per day ("Mon: task, task") and a sentence on what you moved later.',
  ].join('\n');
  return { label: `Plan ${win.label}`, text, win };
}

export async function threeQuestion(toolbox, today = todayISO()) {
  const [tasks, goals] = await Promise.all([lookup(toolbox, 'find_tasks', {}), lookup(toolbox, 'lists', { name: 'goals' })]);
  const text = [
    `Pick my three for today (${day(today, { weekday: 'long' })} ${today}).`,
    '',
    `Open tasks (refs for update_task): ${tasks}`,
    `Goals list: ${goals}`,
    '',
    'Star the three tasks that matter most today with update_task, and unstar the other starred ones (at most 3 can be starred: do the unstarring first).',
    'Prefer overdue, due today, high priority, and whatever moves a goal forward.',
    'Then answer with the three, one short reason each.',
  ].join('\n');
  return { label: 'Pick my three for today', text };
}

/** The week as planned (after the accepted changes), for the review file. */
export function planMarkdown(win, tasks) {
  const open = tasks.filter((t) => t.status !== 'done');
  const lines = [`## Plan for ${win.label} (${short(win.start)} – ${short(win.end)})`, ''];
  for (const d of win.days) {
    const due = open.filter((t) => t.due_date === d).map((t) => `${t.title}${t.repeat ? ' ↻' : ''}`);
    lines.push(`**${day(d)} ${short(d)}** — ${due.length ? due.join(' · ') : 'free'}`);
  }
  const starred = open.filter((t) => t.is_starred).map((t) => t.title);
  if (starred.length) lines.push('', `**Starred:** ${starred.join(' · ')}`);
  return `${lines.join('\n')}\n`;
}

/** → { ok, message } (jweek says whether it went into the review or waits for it) */
export async function savePlan(win, tasks) {
  const res = await runCapture('jweek', ['--plan', '--week', win.review], { input: planMarkdown(win, tasks) });
  if (res.ok) return { ok: true, message: res.stdout.trim().split('\n').pop() || `Plan saved for reviews/${win.review}.md` };
  return { ok: false, message: res.stderr.trim() || 'jweek --plan failed' };
}
