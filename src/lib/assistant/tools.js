// Ask Magnus tools: what the model can look at, and the changes it can
// propose. Read tools return compact JSON (small results keep the local
// model's context, and its memory use, small). Write tools never write:
// they return a proposal the user confirms afterwards (apply.js).
//
// Tasks are referred to by short refs ("t3") instead of UUIDs, which small
// models copy unreliably. Refs stay stable for a whole conversation.
import * as tasksApi from '../data/tasks.js';
import * as categoriesApi from '../data/categories.js';
import * as routinesApi from '../data/routines.js';
import * as completionsApi from '../data/completions.js';
import * as projectsApi from '../data/projects.js';
import * as projectTasksApi from '../data/projectTasks.js';
import * as booksApi from '../data/books.js';
import * as listsApi from '../data/lists.js';
import * as focusApi from '../data/focus.js';
import * as logsApi from '../data/logs.js';
import { todayISO, addDays, computeStreak } from '../data/completions.js';
import { groupUpcoming, focusByWhat, localDate } from '../stats.js';
import { parseQuickAdd, findList } from '../quickadd.js';
import { parseDateInput } from '../dates.js';
import { TIME_OF_DAY } from '../display.js';
import { parseRepeatToken, describeRepeat, firstDue } from '../repeat.js';

export const MAX_STARRED = 3;
const MAX_ROWS = 40;

const obj = (properties, required = []) => ({ type: 'object', properties, required });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const int = (description) => ({ type: 'integer', description });
const bool = (description) => ({ type: 'boolean', description });

export const TOOL_DEFS = [
  {
    name: 'find_tasks',
    description: 'Look up tasks. Open tasks unless status says otherwise. Returns refs (t1, t2, …) to use with update_task.',
    parameters: obj({
      status: str('open (default), done, or all', { enum: ['open', 'done', 'all'] }),
      due: str('overdue, today, tomorrow, this_week (today through 7 days out), undated, or any (default)', {
        enum: ['overdue', 'today', 'tomorrow', 'this_week', 'undated', 'any'],
      }),
      starred: bool('only starred (true) or only unstarred (false) tasks'),
      category: str('category name, e.g. Work'),
      text: str('words that appear in the title or notes'),
    }),
  },
  {
    name: 'upcoming',
    description: 'Overdue tasks, then today, tomorrow and the next 7 days: tasks by due date and projects by target date.',
    parameters: obj({}),
  },
  {
    name: 'routines',
    description: 'Daily routines (habits) by time of day: whether each is done on the date, and its current streak.',
    parameters: obj({ date: str('YYYY-MM-DD, default today') }),
  },
  {
    name: 'projects',
    description: 'Projects with status, target date and how many checklist items are left.',
    parameters: obj({ include_done: bool('also list finished projects') }),
  },
  {
    name: 'log_history',
    description: 'The daily Log: mood (1–5), energy (1–5), sleep (hours), weight and workouts (minutes), per day.',
    parameters: obj({ days: int('how many days back, including today (default 14, max 90)') }),
  },
  {
    name: 'focus_summary',
    description: 'Focus timer minutes: total, per day, and by what the time went to.',
    parameters: obj({ days: int('how many days back, including today (default 7, max 90)') }),
  },
  {
    name: 'library',
    description: 'Books: reading, want_to_read, finished or dnf, with dates and ratings.',
    parameters: obj({ status: str('reading, want_to_read, finished, dnf, or all (default)', { enum: ['reading', 'want_to_read', 'finished', 'dnf', 'all'] }) }),
  },
  {
    name: 'lists',
    description: 'Named lists (Groceries, Goals, …). Without a name: every list with its unchecked items. With a name: that list, checked items too.',
    parameters: obj({ name: str('list name, e.g. Goals') }),
  },
  {
    name: 'add_task',
    description:
      'Propose a new task (the user confirms it later). Write it as a quick-add line: the title plus optional tokens — a due date (today, tomorrow, fri, +3, 2026-11-02), !high or !low, #category, * to star, and a repeat: ~daily ~weekdays ~weekly ~mon,thu ~monthly ~1st ~15th ~last ~yearly ~3d ~2w ~6m.',
    parameters: obj({ text: str('e.g. "renew passport fri !high #home"') }, ['text']),
  },
  {
    name: 'update_task',
    description:
      'Propose a change to one existing task (the user confirms it later). Use a ref from find_tasks or upcoming. Leave out the fields you are not changing. due accepts YYYY-MM-DD, today, tomorrow, a weekday, +N, or "none" to remove the due date.',
    parameters: obj(
      {
        ref: str('task ref, e.g. t3'),
        title: str('new title'),
        due: str('new due date'),
        priority: str('low, medium or high', { enum: ['low', 'medium', 'high'] }),
        starred: bool('star or unstar'),
        status: str('todo, doing or done', { enum: ['todo', 'doing', 'done'] }),
        repeat: str('make it repeat: ~daily ~weekdays ~weekly ~mon,thu ~monthly ~1st ~last ~yearly ~3d ~2w ~6m, or "none" to stop repeating'),
      },
      ['ref']
    ),
  },
  {
    name: 'log',
    description: 'Propose a Log entry (the user confirms it later): mood or energy 1–5, sleep in hours, weight, or a workout in minutes.',
    parameters: obj(
      {
        metric: str('mood, energy, sleep, weight or workout', { enum: logsApi.LOG_METRICS }),
        value: { type: 'number', description: 'the number' },
        date: str('YYYY-MM-DD, today or yesterday (default today)'),
        note: str('workout type, e.g. run'),
      },
      ['metric', 'value']
    ),
  },
];

export const WRITE_TOOLS = new Set(['add_task', 'update_task', 'log']);

function weekday(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

// Strip empty fields so results stay short.
function compact(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false && v !== ''));
}

function clampDays(n, def) {
  const d = Number.isFinite(Number(n)) ? Math.round(Number(n)) : def;
  return Math.min(90, Math.max(1, d));
}

/**
 * One toolbox per conversation. `run(name, args)` returns
 * `{ result, proposal? }`; result is the JSON string the model sees.
 */
export function createToolbox({ now = () => new Date() } = {}) {
  const refs = new Map(); // ref → task id
  const refOf = new Map(); // task id → ref
  let cache = {};
  const proposals = [];
  let planning = false; // Plan my week: repeating tasks keep their dates

  const today = () => todayISO();
  const load = (key, fn) => (cache[key] ??= fn());
  const tasks = () => load('tasks', () => tasksApi.listTasks());
  const categories = () => load('categories', () => categoriesApi.listCategories());

  const refFor = (task) => {
    if (!refOf.has(task.id)) {
      const ref = `t${refOf.size + 1}`;
      refOf.set(task.id, ref);
      refs.set(ref, task.id);
    }
    return refOf.get(task.id);
  };

  const taskRow = (t, cats) =>
    compact({
      ref: refFor(t),
      title: t.title,
      status: t.status === 'todo' ? null : t.status,
      due: t.due_date ? `${t.due_date} ${weekday(t.due_date)}` : null,
      priority: t.priority === 'medium' ? null : t.priority,
      starred: t.is_starred,
      category: cats.find((c) => c.id === t.category_id)?.name,
      done: t.completed_at ? localDate(t.completed_at) : null,
      repeats: t.repeat ? describeRepeat(t.repeat) : null,
    });

  const handlers = {
    async find_tasks({ status = 'open', due = 'any', starred, category, text } = {}) {
      const [all, cats] = await Promise.all([tasks(), categories()]);
      const d = today();
      const end = addDays(d, 7);
      let rows = all.filter((t) => (status === 'all' ? true : status === 'done' ? t.status === 'done' : t.status !== 'done'));
      const dueTest = {
        overdue: (t) => t.status !== 'done' && t.due_date && t.due_date < d, // a finished task is never overdue
        today: (t) => t.due_date === d,
        tomorrow: (t) => t.due_date === addDays(d, 1),
        this_week: (t) => t.due_date && t.due_date >= d && t.due_date <= end,
        undated: (t) => !t.due_date,
      }[due];
      if (dueTest) rows = rows.filter(dueTest);
      if (typeof starred === 'boolean') rows = rows.filter((t) => Boolean(t.is_starred) === starred);
      if (category) {
        const c = category.replace(/^#/, '').toLowerCase();
        const ids = new Set(cats.filter((x) => x.name.toLowerCase().startsWith(c)).map((x) => x.id));
        rows = rows.filter((t) => ids.has(t.category_id));
      }
      if (text) {
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        rows = rows.filter((t) => words.every((w) => `${t.title} ${t.notes || ''}`.toLowerCase().includes(w)));
      }
      if (status === 'done') rows.sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
      else rows.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
      return { count: rows.length, tasks: rows.slice(0, MAX_ROWS).map((t) => taskRow(t, cats)) };
    },

    async upcoming() {
      const [all, cats, projects] = await Promise.all([tasks(), categories(), load('projects', () => projectsApi.listProjects())]);
      const groups = groupUpcoming(all, projects, today());
      const out = {};
      for (const [g, items] of Object.entries(groups)) {
        out[g] = items.slice(0, MAX_ROWS).map((x) =>
          x.kind === 'task' ? taskRow(x.item, cats) : compact({ project: x.item.name, target: `${x.date} ${weekday(x.date)}` })
        );
      }
      return out;
    },

    async routines({ date } = {}) {
      const day = date ? parseDateInput(date) : today();
      const [routines, completions] = await Promise.all([routinesApi.listRoutines(), completionsApi.listCompletions()]);
      const out = {};
      for (const tod of TIME_OF_DAY) {
        const group = routines.filter((r) => r.time_of_day === tod).sort((a, b) => a.sort_order - b.sort_order);
        if (!group.length) continue;
        out[tod] = group.map((r) => {
          const set = completions.get(r.id) || new Set();
          return { name: r.name, done: set.has(day), ...compact({ streak: computeStreak(set, day) || null }) };
        });
      }
      return { date: day, routines: out };
    },

    async projects({ include_done = false } = {}) {
      const [projects, counts] = await Promise.all([projectsApi.listProjects(), projectTasksApi.listTaskCounts()]);
      return projects
        .filter((p) => include_done || p.status !== 'done')
        .map((p) => {
          const items = counts.filter((c) => c.project_id === p.id);
          return compact({
            name: p.name,
            status: p.status,
            target: p.target_date,
            items_left: items.filter((c) => !c.done).length,
            items_done: items.filter((c) => c.done).length,
          });
        });
    },

    async log_history({ days } = {}) {
      const n = clampDays(days, 14);
      const from = addDays(today(), -(n - 1));
      const rows = await logsApi.listLogs(from);
      const byDay = new Map();
      for (const e of rows) {
        const day = byDay.get(e.entry_date) || {};
        if (e.metric === 'workout') (day.workouts ||= []).push(`${Number(e.value)} min${e.note ? ` ${e.note}` : ''}`);
        else day[e.metric] = Number(e.value);
        byDay.set(e.entry_date, day);
      }
      return { from, days: [...byDay.entries()].map(([date, v]) => ({ date: `${date} ${weekday(date)}`, ...v })) };
    },

    async focus_summary({ days } = {}) {
      const n = clampDays(days, 7);
      const d = today();
      const from = addDays(d, -(n - 1));
      const [sessions, all] = await Promise.all([
        focusApi.listFocusSessions(new Date(addDays(from, -1) + 'T00:00:00').toISOString()),
        tasks(),
      ]);
      const inRange = sessions.filter((s) => localDate(s.started_at) >= from && localDate(s.started_at) <= d);
      const perDay = {};
      for (const s of inRange) perDay[localDate(s.started_at)] = (perDay[localDate(s.started_at)] || 0) + s.minutes;
      return {
        from,
        total_minutes: inRange.reduce((m, s) => m + s.minutes, 0),
        per_day: perDay,
        by_what: focusByWhat(sessions, all, d, n).slice(0, 10),
      };
    },

    async library({ status = 'all' } = {}) {
      const books = await booksApi.listBooks();
      return books
        .filter((b) => status === 'all' || b.status === status)
        .slice(0, MAX_ROWS)
        .map((b) => compact({ title: b.title, author: b.author, status: b.status, started: b.started_date, finished: b.finished_date, rating: b.rating }));
    },

    async lists({ name } = {}) {
      const [lists, items] = await Promise.all([listsApi.listLists(), listsApi.listAllItems()]);
      const itemsOf = (l, all) =>
        items
          .filter((i) => i.list_id === l.id && (all || !i.done))
          .sort((a, b) => a.sort_order - b.sort_order)
          .slice(0, MAX_ROWS)
          .map((i) => compact({ text: i.text, done: i.done, price: i.price }));
      if (name) {
        const l = findList(lists, name);
        if (!l) return { error: `no list named "${name}"`, lists: lists.map((x) => x.name) };
        return { name: l.name, items: itemsOf(l, true) };
      }
      return lists.map((l) => ({ name: l.name, unchecked: itemsOf(l, false) }));
    },

    async add_task({ text } = {}) {
      const [all, cats] = await Promise.all([tasks(), categories()]);
      const parsed = parseQuickAdd(text, cats, now());
      if (parsed.inbox != null || parsed.book || parsed.list != null) throw new Error('add_task only adds tasks');
      if (!parsed.title) throw new Error('the task needs a title');
      const fields = {
        title: parsed.title,
        due_date: parsed.due_date,
        priority: parsed.priority,
        category_id: parsed.category_id,
        is_starred: parsed.is_starred,
        ...(parsed.repeat ? { repeat: parsed.repeat } : {}),
      };
      let note = '';
      if (fields.is_starred && starredCount(all) >= MAX_STARRED) {
        fields.is_starred = false;
        note = ` (not starred: already ${MAX_STARRED} starred)`;
      }
      const cat = cats.find((c) => c.id === fields.category_id);
      const bits = [fields.due_date && `due ${weekday(fields.due_date)} ${fields.due_date}`, fields.priority !== 'medium' && fields.priority, cat?.name, fields.is_starred && 'starred', fields.repeat && `↻ ${describeRepeat(fields.repeat)}`].filter(Boolean);
      return propose({
        kind: 'create_task',
        fields,
        sortOrder: all.length + proposals.filter((p) => p.kind === 'create_task').length,
        label: `Add “${fields.title}”${bits.length ? ` (${bits.join(' · ')})` : ''}${note}`,
      });
    },

    async update_task({ ref, title, due, priority, starred, status, repeat } = {}) {
      const id = refs.get(String(ref || '').trim());
      const all = await tasks();
      const task = all.find((t) => t.id === id);
      if (!task) throw new Error(`unknown task ref "${ref}" (look tasks up with find_tasks first)`);
      if (planning && task.repeat && ((due != null && String(due).trim() !== '') || (repeat != null && repeat !== ''))) {
        throw new Error(`"${task.title}" repeats (${describeRepeat(task.repeat)}): leave its date and repeat as they are`);
      }
      const changes = {};
      if (title != null && title.trim() && title.trim() !== task.title) changes.title = title.trim();
      // A blank field means "not changing it" (small models fill unused fields with ""); "none" clears.
      const dueText = due == null ? '' : String(due).trim();
      if (dueText) {
        const d = /^(none|no date|clear|remove)$/i.test(dueText) ? null : parseDateInput(dueText, now());
        if (d !== task.due_date) changes.due_date = d;
      }
      if (priority && priority !== task.priority) changes.priority = priority;
      if (status && status !== task.status) changes.status = status;
      if (typeof starred === 'boolean' && starred !== Boolean(task.is_starred)) changes.is_starred = starred;
      if (repeat != null && repeat !== '') {
        const stop = /^(none|no|off|never|stop)$/i.test(String(repeat).trim());
        const anchor = changes.due_date ?? task.due_date ?? today();
        const rule = stop ? null : parseRepeatToken(String(repeat).trim().startsWith('~') ? repeat : `~${repeat}`, anchor);
        if (!stop && !rule) throw new Error(`can't read repeat "${repeat}" (try ~weekly, ~1st, ~mon,thu, ~3d)`);
        if (rule !== (task.repeat ?? null)) changes.repeat = rule;
        if (rule && !(changes.due_date ?? task.due_date)) changes.due_date = firstDue(rule, today());
      }
      if ((changes.status === 'done' || task.status === 'done') && (changes.is_starred ?? task.is_starred)) changes.is_starred = false; // done tasks aren't starred
      if (changes.is_starred && starredCount(all) - (proposals.some((p) => p.id === task.id && p.changes?.is_starred) ? 1 : 0) >= MAX_STARRED) throw new Error(`already ${MAX_STARRED} starred tasks: unstar one first`);
      if (!Object.keys(changes).length) return { result: { unchanged: true, task: task.title } };
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, task[k] ?? null]));
      // A second change to the same task folds into the first proposal.
      const existing = proposals.find((p) => p.kind === 'update_task' && p.id === task.id);
      if (existing) {
        existing.changes = { ...existing.changes, ...changes };
        existing.before = { ...before, ...existing.before };
        existing.label = describeUpdate(task, existing.changes);
        return { result: { proposed: existing.label } };
      }
      return propose({ kind: 'update_task', id: task.id, changes, before, label: describeUpdate(task, changes) });
    },

    async log({ metric, value, date, note } = {}) {
      const n = logsApi.validateMetric(metric, value);
      const day = date ? parseDateInput(date, now()) : today();
      const label =
        metric === 'workout'
          ? `Log a ${n} min workout${note ? ` (${note})` : ''} on ${weekday(day)} ${day}`
          : `Log ${logsApi.LOG_LABELS[metric].toLowerCase()} ${n}${metric === 'sleep' ? ' h' : metric === 'mood' || metric === 'energy' ? '/5' : ''} on ${weekday(day)} ${day}`;
      return propose({ kind: 'log', metric, value: n, date: day, note: metric === 'workout' ? note || null : null, label });
    },
  };

  // Starred tasks once the pending proposals are applied (stars, unstars, done).
  function starredCount(all) {
    const pending = new Map(proposals.filter((p) => p.kind === 'update_task' && 'is_starred' in p.changes).map((p) => [p.id, p.changes.is_starred]));
    const existing = all.filter((t) => t.status !== 'done' && (pending.has(t.id) ? pending.get(t.id) : t.is_starred)).length;
    const added = proposals.filter((p) => p.kind === 'create_task' && p.fields.is_starred).length;
    return existing + added;
  }

  function propose(p) {
    proposals.push(p);
    return { result: { proposed: p.label, note: 'Not applied yet: the user confirms after your answer.' }, proposal: p };
  }

  return {
    defs: TOOL_DEFS,
    proposals,
    /** Forget cached rows (each new question sees fresh data); refs stay. */
    fresh() {
      cache = {};
    },
    /** While planning the week, refuse to move repeating tasks. */
    setPlanning(on) {
      planning = Boolean(on);
    },
    /** Start a new batch of proposals (after they were applied or discarded). */
    clearProposals() {
      proposals.length = 0;
    },
    async run(name, args) {
      const fn = handlers[name];
      if (!fn) return { result: JSON.stringify({ error: `no tool named ${name}` }) };
      try {
        const out = await fn(args && typeof args === 'object' ? args : {});
        // Write tools return { result, proposal? }; read tools return the data itself.
        if (WRITE_TOOLS.has(name)) return { result: JSON.stringify(out.result), proposal: out.proposal };
        return { result: JSON.stringify(out) };
      } catch (err) {
        return { result: JSON.stringify({ error: String(err.message || err) }) };
      }
    },
  };
}

function describeUpdate(task, changes) {
  const parts = [];
  if (changes.title) parts.push(`rename to “${changes.title}”`);
  if ('due_date' in changes) parts.push(changes.due_date ? `due ${weekday(changes.due_date)} ${changes.due_date}` : 'no due date');
  if (changes.priority) parts.push(`${changes.priority} priority`);
  if (changes.status) parts.push(changes.status === 'done' ? 'mark done' : `status ${changes.status}`);
  if ('repeat' in changes) parts.push(changes.repeat ? `repeat ${describeRepeat(changes.repeat)}` : 'stop repeating');
  if ('is_starred' in changes && changes.status !== 'done') parts.push(changes.is_starred ? 'star' : 'unstar');
  return `“${task.title}”: ${parts.join(', ')}`;
}
