// Markdown digests of Life Tracker data for the journal scripts:
//   `magnus context`              → the "Today" section `today` adds to a new daily entry
//   `magnus context --week W`     → the Life Tracker half of `jweek`'s weekly review
// Pure formatting lives in formatDay/formatWeek (unit-tested); loadDay/loadWeek fetch.
import * as tasksApi from './data/tasks.js';
import * as routinesApi from './data/routines.js';
import * as completionsApi from './data/completions.js';
import * as projectsApi from './data/projects.js';
import * as quotesApi from './data/quotes.js';
import * as booksApi from './data/books.js';
import * as focusApi from './data/focus.js';
import * as logsApi from './data/logs.js';
import { TIME_OF_DAY, TIME_OF_DAY_LABELS } from './display.js';
import { addDays } from './data/completions.js';
import { average, localDate, isoWeekMonday } from './stats.js';

function shortDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function oneLine(text) {
  return String(text || '').replace(/\s*\n\s*/g, ' ').trim();
}

// Optional-table loads: before schema_003 runs these just come back empty.
async function optional(promise) {
  try {
    return await promise;
  } catch (err) {
    if (logsApi.isMissingSchema(err)) return [];
    throw err;
  }
}

export async function loadDay() {
  const [tasks, routines, completions, projects, books, quote] = await Promise.all([
    tasksApi.listTasks(),
    routinesApi.listRoutines(),
    completionsApi.listCompletions(),
    projectsApi.listProjects(),
    booksApi.listBooks(),
    quotesApi.pickRandomQuote(),
  ]);
  return { tasks, routines, completions, projects, books, quote };
}

export function formatDay({ tasks, routines, completions, projects, books, quote }, today) {
  const open = tasks.filter((t) => t.status !== 'done');
  const starred = open.filter((t) => t.is_starred);
  const due = open.filter((t) => !t.is_starred && t.due_date && t.due_date <= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const weekEnd = addDays(today, 7);
  const projectsDue = projects.filter((p) => p.status !== 'done' && p.target_date && p.target_date <= weekEnd);
  const reading = books.filter((b) => b.status === 'reading');
  const dueNote = (t) => {
    if (!t.due_date) return '';
    if (t.due_date < today) return ` — overdue (${shortDate(t.due_date)})`;
    if (t.due_date === today) return ' — due today';
    return ` — due ${shortDate(t.due_date)}`;
  };

  const out = ['## Today', ''];
  if (starred.length) out.push('**Starred**', ...starred.map((t) => `- ${oneLine(t.title)}${dueNote(t)}`), '');
  if (due.length) out.push('**Due**', ...due.map((t) => `- ${oneLine(t.title)}${dueNote(t)}`), '');
  if (projectsDue.length) {
    out.push('**Projects due soon**', ...projectsDue.map((p) => `- ${oneLine(p.name)} — ${p.target_date < today ? 'overdue' : 'target'} ${shortDate(p.target_date)}`), '');
  }
  if (routines.length) {
    out.push('**Routines**');
    for (const tod of TIME_OF_DAY) {
      const group = routines.filter((r) => r.time_of_day === tod).sort((a, b) => a.sort_order - b.sort_order);
      if (!group.length) continue;
      const names = group.map((r) => oneLine(r.name) + ((completions.get(r.id) || new Set()).has(today) ? ' ✓' : ''));
      out.push(`- ${TIME_OF_DAY_LABELS[tod]}: ${names.join(', ')}`);
    }
    out.push('');
  }
  if (reading.length) out.push(`**Reading:** ${reading.map((b) => `_${oneLine(b.title)}_`).join(', ')}`, '');
  if (quote?.quote_text) {
    const attribution = quotesApi.formatAttribution(quote, books);
    out.push(...String(quote.quote_text).trim().split('\n').map((l) => `> ${l}`));
    if (attribution) out.push(`> — ${oneLine(attribution).replace(/^[—-]\s*/, '')}`);
    out.push('');
  }
  if (out.length === 2) return '';
  return out.join('\n').replace(/\n+$/, '\n');
}

export async function loadWeek(weekLabel) {
  const monday = isoWeekMonday(weekLabel);
  const sunday = addDays(monday, 6);
  const [tasks, routines, completions, books, focus, logs] = await Promise.all([
    tasksApi.listTasks(),
    routinesApi.listRoutines(),
    completionsApi.listCompletions(),
    booksApi.listBooks(),
    optional(focusApi.listFocusSessions(new Date(addDays(monday, -1) + 'T00:00:00').toISOString())),
    optional(logsApi.listLogs(monday)),
  ]);
  return { monday, sunday, tasks, routines, completions, books, focus, logs };
}

export function formatWeek({ monday, sunday, tasks, routines, completions, books, focus, logs }, today) {
  const end = sunday < today ? sunday : today; // a week in progress counts days so far
  const days = Math.max(1, Math.round((new Date(end + 'T00:00:00') - new Date(monday + 'T00:00:00')) / 86400000) + 1);
  const inWeek = (d) => d >= monday && d <= sunday;
  const done = tasks.filter((t) => t.status === 'done' && t.completed_at && inWeek(localDate(t.completed_at)));
  const focusMin = focus.filter((s) => inWeek(localDate(s.started_at))).reduce((n, s) => n + s.minutes, 0);
  const weekLogs = logs.filter((e) => inWeek(e.entry_date));
  const avg = (metric) => average(weekLogs.filter((e) => e.metric === metric).map((e) => Number(e.value)));
  const workouts = weekLogs.filter((e) => e.metric === 'workout');
  const finished = books.filter((b) => b.status === 'finished' && b.finished_date && inWeek(b.finished_date));

  const out = ['## Life Tracker', ''];
  out.push(`**Tasks finished (${done.length})**`);
  out.push(...(done.length ? done.map((t) => `- ${oneLine(t.title)}`) : ['- none recorded']), '');
  if (routines.length) {
    out.push(`**Routines** (${days} day${days === 1 ? '' : 's'})`);
    for (const r of routines) {
      const set = completions.get(r.id) || new Set();
      let n = 0;
      for (let i = 0; i < days; i++) if (set.has(addDays(monday, i))) n++;
      out.push(`- ${oneLine(r.name)}: ${n}/${days}`);
    }
    out.push('');
  }
  const stats = [];
  if (focusMin) stats.push(`Focus: ${Math.floor(focusMin / 60)}h ${focusMin % 60}m`);
  const fmt = (v, digits = 1) => (v == null ? null : v.toFixed(digits).replace(/\.0$/, ''));
  if (avg('mood') != null) stats.push(`Mood avg: ${fmt(avg('mood'))}/5`);
  if (avg('energy') != null) stats.push(`Energy avg: ${fmt(avg('energy'))}/5`);
  if (avg('sleep') != null) stats.push(`Sleep avg: ${fmt(avg('sleep'))} h`);
  if (workouts.length) stats.push(`Workouts: ${workouts.length} (${workouts.reduce((n, e) => n + Number(e.value), 0)} min)`);
  if (stats.length) out.push(...stats.map((s) => `- ${s}`), '');
  if (finished.length) out.push(`**Books finished:** ${finished.map((b) => `_${oneLine(b.title)}_`).join(', ')}`, '');
  return out.join('\n').replace(/\n+$/, '\n');
}

// ---------- end of day (`magnus context --close`, used by `today --close`) ----------

export async function loadClose(dateISO) {
  const [tasks, routines, completions, focus, logs] = await Promise.all([
    tasksApi.listTasks(),
    routinesApi.listRoutines(),
    completionsApi.listCompletions(),
    optional(focusApi.listFocusSessions(new Date(addDays(dateISO, -1) + 'T00:00:00').toISOString())),
    optional(logsApi.listLogs(dateISO)),
  ]);
  return { tasks, routines, completions, focus, logs };
}

export function formatClose({ tasks, routines, completions, focus, logs }, date) {
  const done = tasks.filter((t) => t.status === 'done' && t.completed_at && localDate(t.completed_at) === date);
  const carry = tasks
    .filter((t) => t.status !== 'done' && (t.is_starred || (t.due_date && t.due_date <= date)))
    .map((t) => `${oneLine(t.title)}${t.due_date && t.due_date < date ? ' (overdue)' : ''}`);
  const doneRoutines = routines.filter((r) => (completions.get(r.id) || new Set()).has(date));
  const missed = routines.filter((r) => !(completions.get(r.id) || new Set()).has(date));
  const focusMin = focus.filter((s) => localDate(s.started_at) === date).reduce((n, s) => n + s.minutes, 0);
  const workouts = logs.filter((e) => e.entry_date === date && e.metric === 'workout');

  const out = ['## Evening', ''];
  out.push(`**Finished today (${done.length})**`, ...(done.length ? done.map((t) => `- ${oneLine(t.title)}`) : ['- nothing marked done']), '');
  if (routines.length) {
    out.push(`**Routines:** ${doneRoutines.length}/${routines.length}${missed.length ? ` · missed: ${missed.map((r) => oneLine(r.name)).join(', ')}` : ' · all done ✓'}`, '');
  }
  const extras = [];
  if (focusMin) extras.push(`Focus: ${Math.floor(focusMin / 60) ? `${Math.floor(focusMin / 60)}h ` : ''}${focusMin % 60}m`);
  if (workouts.length) extras.push(`Workout: ${workouts.map((w) => `${Number(w.value)} min${w.note ? ` ${oneLine(w.note)}` : ''}`).join(', ')}`);
  if (extras.length) out.push(...extras.map((e) => `- ${e}`), '');
  if (carry.length) out.push('**Carrying over**', ...carry.map((c) => `- ${c}`), '');
  out.push('**What went well?**', '', '**What would I do differently?**', '');
  return out.join('\n').replace(/\n+$/, '\n');
}
