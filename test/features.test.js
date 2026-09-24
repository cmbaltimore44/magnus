// Pure logic behind the 2026-09 feature batch (shared with the web app).
process.env.MAGNUS_DEMO = '1';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, describeQuickAdd } from '../src/lib/quickadd.js';

const NOW = new Date(2026, 8, 23); // Wed 2026-09-23
const CATS = [
  { id: 'h', name: 'Home' },
  { id: 'hl', name: 'Health' },
  { id: 'w', name: 'Work' },
];

test('quick add parses date, priority, category and star', () => {
  assert.deepEqual(parseQuickAdd('renew passport fri !high #home *', CATS, NOW), {
    title: 'renew passport',
    due_date: '2026-09-25',
    priority: 'high',
    category_id: 'h',
    is_starred: true,
  });
  const p = parseQuickAdd('pay rent +3 !l #wor', CATS, NOW);
  assert.equal(p.due_date, '2026-09-26');
  assert.equal(p.priority, 'low');
  assert.equal(p.category_id, 'w');
  assert.equal(parseQuickAdd('x #h', CATS, NOW).category_id, 'h'); // first prefix match
  assert.equal(parseQuickAdd('x #health', CATS, NOW).category_id, 'hl'); // exact beats prefix
});

test('quick add keeps unresolved tokens in the title', () => {
  const p = parseQuickAdd('call #mom about 13/45 !urgent', CATS, NOW);
  assert.equal(p.title, 'call #mom about 13/45 !urgent');
  assert.equal(p.due_date, null);
  assert.equal(p.priority, 'medium');
  assert.equal(parseQuickAdd('meet fri then sat', CATS, NOW).title, 'meet then sat'); // only the first date
});

test('quick add routes > to the inbox and describes a parse', () => {
  assert.deepEqual(parseQuickAdd('>  a thought', CATS, NOW), { inbox: 'a thought' });
  assert.equal(describeQuickAdd(parseQuickAdd('x tom !h #home *', CATS, NOW), CATS), 'due 2026-09-24 · high priority · Home · starred');
  assert.equal(describeQuickAdd(parseQuickAdd('x', CATS, NOW), CATS), '');
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkinFlags, todayEntryHasCheckin, todayEntryPath } from '../src/lib/journal.js';
import { formatDay } from '../src/lib/digest.js';

test('daily check-in flags', () => {
  assert.deepEqual(checkinFlags('4 3 7.5'), ['--mood', '4', '--energy', '3', '--sleep', '7.5']);
  assert.deepEqual(checkinFlags('- - 6'), ['--sleep', '6']);
  assert.deepEqual(checkinFlags(''), []);
  assert.throws(() => checkinFlags('6'), /mood is 1–5/);
  assert.throws(() => checkinFlags('3 3 30'), /sleep/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-j-'));
  const file = todayEntryPath(new Date(2026, 8, 23), dir);
  assert.equal(file, path.join(dir, 'daily/2026/09/2026-09-23.md'));
  assert.equal(todayEntryHasCheckin(file), false);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '---\ndate: 2026-09-23\n---\nmood: 4 in the body does not count\n');
  assert.equal(todayEntryHasCheckin(file), false);
  fs.writeFileSync(file, '---\ndate: 2026-09-23\nmood: 4\n---\n');
  assert.equal(todayEntryHasCheckin(file), true);
  fs.rmSync(dir, { recursive: true });
});

test('day context markdown', () => {
  const today = '2026-09-23';
  const md = formatDay(
    {
      tasks: [
        { title: 'Starred one', status: 'todo', is_starred: true, due_date: '2026-09-24' },
        { title: 'Late', status: 'todo', is_starred: false, due_date: '2026-09-20' },
        { title: 'Done', status: 'done', is_starred: false, due_date: '2026-09-20' },
        { title: 'Later', status: 'todo', is_starred: false, due_date: '2026-10-20' },
      ],
      routines: [{ id: 'r', name: 'Stretch', time_of_day: 'morning', sort_order: 0 }],
      completions: new Map([['r', new Set([today])]]),
      projects: [],
      books: [],
      quote: { quote_text: 'Line one\nLine two', attribution: '— Someone', book_id: null },
    },
    today
  );
  assert.match(md, /\*\*Starred\*\*\n- Starred one — due Thu, Sep 24/);
  assert.match(md, /\*\*Due\*\*\n- Late — overdue \(Sun, Sep 20\)\n\n/);
  assert.doesNotMatch(md, /Done|Later/);
  assert.match(md, /- Morning: Stretch ✓/);
  assert.match(md, /> Line one\n> Line two\n> — Someone/);
  assert.equal(formatDay({ tasks: [], routines: [], completions: new Map(), projects: [], books: [], quote: null }, today), '');
});

import { supabase } from '../src/lib/supabase.js';
import { deleteWithUndo } from '../src/lib/undo.js';
import { groupUpcoming } from '../src/lib/stats.js';

test('undo restores a deleted row and its cascaded / detached children', async () => {
  const { data: projects } = await supabase.from('projects').select('*');
  const project = projects[0];
  const before = (await supabase.from('project_tasks').select('*').eq('project_id', project.id)).data.length;
  assert.ok(before > 0);
  const restore = await deleteWithUndo('projects', project.id);
  assert.equal((await supabase.from('projects').select('*').eq('id', project.id)).data.length, 0);
  assert.equal((await supabase.from('project_tasks').select('*').eq('project_id', project.id)).data.length, 0);
  await restore();
  assert.equal((await supabase.from('projects').select('*').eq('id', project.id).single()).data.name, project.name);
  assert.equal((await supabase.from('project_tasks').select('*').eq('project_id', project.id)).data.length, before);

  const { data: cats } = await supabase.from('categories').select('*');
  const tagged = (await supabase.from('tasks').select('*').eq('category_id', cats[0].id)).data.length;
  const restoreCat = await deleteWithUndo('categories', cats[0].id);
  assert.equal((await supabase.from('tasks').select('*').eq('category_id', cats[0].id)).data.length, 0);
  await restoreCat();
  assert.equal((await supabase.from('tasks').select('*').eq('category_id', cats[0].id)).data.length, tagged);
});

test('upcoming groups overdue / today / tomorrow / next 7 days', () => {
  const t = (id, due_date, status = 'todo') => ({ id, due_date, status });
  const g = groupUpcoming(
    [t('a', '2026-09-20'), t('b', '2026-09-23'), t('c', '2026-09-24'), t('d', '2026-09-30'), t('e', '2026-10-01'), t('f', '2026-09-20', 'done'), t('g', null)],
    [{ id: 'p', target_date: '2026-09-25', status: 'in_progress' }, { id: 'q', target_date: '2026-09-25', status: 'done' }],
    '2026-09-23'
  );
  const ids = (k) => g[k].map((x) => x.item.id);
  assert.deepEqual(ids('overdue'), ['a']);
  assert.deepEqual(ids('today'), ['b']);
  assert.deepEqual(ids('tomorrow'), ['c']);
  assert.deepEqual(ids('week'), ['p', 'd']);
});

import { writingStreak, entriesByDate } from '../src/lib/journal.js';

test('writing streak counts consecutive daily entries with a grace day', () => {
  const e = (type, date) => ({ type, date });
  const entries = [e('daily', '2026-09-22'), e('daily', '2026-09-21'), e('essay', '2026-09-20'), e('daily', '2026-09-19')];
  assert.equal(writingStreak(entries, '2026-09-23'), 2); // today not written yet
  assert.equal(writingStreak([...entries, e('daily', '2026-09-23')], '2026-09-23'), 3);
  assert.equal(writingStreak(entries, '2026-09-25'), 0);
  assert.equal(entriesByDate(entries).get('2026-09-20'), 1);
});

import { focusElapsedMs, formatRemaining } from '../src/ui/useFocusTimer.js';

test('focus timer elapsed time excludes pauses', () => {
  const t = { startedAt: 0, minutes: 25, pausedAt: null, pausedMs: 60000 };
  assert.equal(focusElapsedMs(t, 5 * 60000), 4 * 60000);
  assert.equal(formatRemaining(t, 5 * 60000), '21:00');
  assert.equal(focusElapsedMs({ ...t, pausedAt: 3 * 60000 }, 10 * 60000), 2 * 60000);
  assert.equal(formatRemaining({ ...t, startedAt: -1e9 }, 0), '0:00');
});

import { bookStats } from '../src/lib/stats.js';

test('book stats', () => {
  const b = (status, extra = {}) => ({ status, format: 'none', rating: null, author: null, ...extra });
  const st = bookStats(
    [
      b('finished', { finished_date: '2026-03-01', started_date: '2026-02-01', rating: 5, format: 'ebook', author: 'Eliot' }),
      b('finished', { finished_date: '2025-06-01', rating: 3, author: 'Eliot' }),
      b('reading'),
      b('want_to_read'),
      b('dnf', { rating: 1 }),
    ],
    '2026-09-23'
  );
  assert.equal(st.finishedThisYear, 1);
  assert.equal(st.finished, 2);
  assert.equal(st.averageRating, 3);
  assert.deepEqual(st.ratingCounts, [1, 0, 1, 0, 1]);
  assert.equal(st.averageDays, 28);
  assert.deepEqual(st.byYear, [['2026', 1], ['2025', 1]]);
  assert.deepEqual(st.topAuthors, [['Eliot', 2]]);
});
