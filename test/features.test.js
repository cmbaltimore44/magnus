// Pure logic behind the 2026-09 feature batch (shared with the web app).

import './_demo.js';
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

import { fuzzyScore } from '../src/lib/fuzzy.js';

test('palette fuzzy match prefers word starts', () => {
  assert.ok(fuzzyScore('nb', 'Library New book') > fuzzyScore('nb', 'Journal Browse Entries'));
  assert.equal(fuzzyScore('xyz', 'Library New book'), 0);
  assert.ok(fuzzyScore('trg', 'Journal Triage Inbox') > 0);
});

import { formatClose } from '../src/lib/digest.js';

test('end-of-day Evening section', () => {
  const date = '2026-09-24';
  const md = formatClose(
    {
      tasks: [
        { title: 'Shipped it', status: 'done', completed_at: new Date(2026, 8, 24, 15).toISOString() },
        { title: 'Yesterday', status: 'done', completed_at: new Date(2026, 8, 23, 15).toISOString() },
        { title: 'Late', status: 'todo', due_date: '2026-09-20' },
        { title: 'Starred', status: 'todo', is_starred: true },
        { title: 'Someday', status: 'todo' },
      ],
      routines: [{ id: 'a', name: 'Stretch' }, { id: 'b', name: 'Read' }],
      completions: new Map([['a', new Set([date])]]),
      focus: [{ started_at: new Date(2026, 8, 24, 10).toISOString(), minutes: 50 }],
      logs: [{ entry_date: date, metric: 'workout', value: 30, note: 'run' }],
    },
    date
  );
  assert.match(md, /\*\*Finished today \(1\)\*\*\n- Shipped it\n/);
  assert.match(md, /\*\*Routines:\*\* 1\/2 · missed: Read/);
  assert.match(md, /- Focus: 50m\n- Workout: 30 min run/);
  assert.match(md, /\*\*Carrying over\*\*\n- Late \(overdue\)\n- Starred\n<!-- end evening summary -->\n\n\*\*What went well\?\*\*/);
  assert.match(md, /^## Evening\n\n<!-- evening summary: refreshed by today --close -->\n\*\*Finished today/);
  assert.doesNotMatch(md, /Someday|Yesterday/);
});

import { findList } from '../src/lib/quickadd.js';
import { cleanUrl } from '../src/lib/data/lists.js';

test('quick add +list and list helpers', () => {
  assert.deepEqual(parseQuickAdd('+groceries oat milk', CATS, NOW), { list: 'groceries', text: 'oat milk' });
  assert.equal(parseQuickAdd('+3 call mom', CATS, NOW).due_date, '2026-09-26'); // still a date
  const lists = [{ id: 'g', name: 'Groceries' }, { id: 'w', name: 'Wish list' }, { id: 'gf', name: 'Gifts' }];
  assert.equal(findList(lists, 'gro').id, 'g');
  assert.equal(findList(lists, 'gifts').id, 'gf');
  assert.equal(findList(lists, 'nope'), null);
  assert.equal(cleanUrl('example.com/x'), 'https://example.com/x');
  assert.equal(cleanUrl(''), null);
  assert.throws(() => cleanUrl('javascript:alert(1)'), /http/);
});

test('undo restores a deleted list with its items', async () => {
  const { data: lists, error } = await supabase.from('lists').select('*');
  assert.equal(error, null, JSON.stringify(error));
  const n = (await supabase.from('list_items').select('*').eq('list_id', lists[0].id)).data.length;
  const restore = await deleteWithUndo('lists', lists[0].id);
  assert.equal((await supabase.from('list_items').select('*').eq('list_id', lists[0].id)).data.length, 0);
  await restore();
  assert.equal((await supabase.from('list_items').select('*').eq('list_id', lists[0].id)).data.length, n);
});

import { parseBookText } from '../src/lib/quickadd.js';
import { clearMatch, normalizeTitle, enrichmentFields } from '../src/lib/openlibrary.js';
import { addWantToRead, needsDetails } from '../src/lib/bookQuickAdd.js';

test('book quick add parsing', () => {
  assert.deepEqual(parseQuickAdd('book: Piranesi by Susanna Clarke', CATS, NOW), { book: { title: 'Piranesi', author: 'Susanna Clarke' } });
  assert.deepEqual(parseQuickAdd('b: 978-0-14-143954-9', CATS, NOW), { book: { isbn: '9780141439549' } });
  assert.deepEqual(parseBookText('Stand by Me by Stephen King'), { title: 'Stand by Me', author: 'Stephen King' });
  assert.deepEqual(parseBookText('Dune'), { title: 'Dune', author: null });
});

test('clear match picks one work, or nothing', () => {
  const c = (title, author, cover = null) => ({ title, author, isbn: '1', cover_image_url: cover });
  assert.equal(normalizeTitle('The Remains of the Day: A Novel'), 'remains of the day');
  const remains = [c('The Remains of the Day', 'Kazuo Ishiguro'), c("Ishiguro's the Remains", 'Adam Parkes'), c('The remains of the day', null), c('Remains of the Day', 'Kazuo Ishiguro', 'x.jpg'), c('The remains of the day', 'N. McNamara')];
  assert.equal(clearMatch({ title: 'the remains of the day' }, remains).cover_image_url, 'x.jpg');
  const split = [c('Emma', 'Jane Austen'), c('Emma', 'Someone Else'), c('Emma', 'A Third')];
  assert.equal(clearMatch({ title: 'Emma' }, split), null);
  assert.equal(clearMatch({ title: 'Emma', author: 'austen' }, split).author, 'Jane Austen');
  assert.equal(clearMatch({ title: 'Nope' }, split), null);
  assert.deepEqual(enrichmentFields({ author: 'Me', cover_image_url: null, isbn: null }, c('x', 'Other', 'y.jpg')), { cover_image_url: 'y.jpg', isbn: '1' });
});

test('addWantToRead saves first, then fills in details', async () => {
  const fake = async () => [{ title: 'Piranesi', author: 'Susanna Clarke', isbn: '9781526622440', cover_image_url: 'https://c/p.jpg' }];
  const { book, enriched } = await addWantToRead('00000000-0000-4000-8000-000000000000', { title: 'piranesi', author: null }, [], { lookup: fake });
  assert.equal(book.status, 'want_to_read');
  assert.ok(needsDetails(book));
  const updated = await enriched;
  assert.equal(updated.author, 'Susanna Clarke');
  assert.equal(updated.title, 'piranesi'); // your title is kept
  assert.ok(!needsDetails(updated));
  const byIsbn = await addWantToRead('00000000-0000-4000-8000-000000000000', { isbn: '9781526622440' }, [], { lookup: fake });
  assert.equal(byIsbn.book.title, 'Piranesi');
  const offline = await addWantToRead('00000000-0000-4000-8000-000000000000', { isbn: '9999999999' }, [], { lookup: async () => { throw new Error('down'); } });
  assert.equal(offline.book.title, 'ISBN 9999999999');
});

import { activeGoals } from '../src/lib/data/lists.js';
import { formatWeek } from '../src/lib/digest.js';

test('goals come from the unchecked items of the "Goals" list, and reach the weekly review', () => {
  const lists = [{ id: 'g', name: ' goals ' }, { id: 'x', name: 'Groceries' }];
  const items = [
    { id: 1, list_id: 'g', text: 'Internship 2027', done: false, sort_order: 1 },
    { id: 2, list_id: 'g', text: 'Old goal', done: true, sort_order: 0 },
    { id: 3, list_id: 'g', text: 'Half marathon', done: false, sort_order: 0 },
    { id: 4, list_id: 'x', text: 'Milk', done: false, sort_order: 0 },
  ];
  assert.deepEqual(activeGoals(lists, items).map((g) => g.text), ['Half marathon', 'Internship 2027']);
  assert.deepEqual(activeGoals([{ id: 'x', name: 'Groceries' }], items), []);
  const md = formatWeek({ monday: '2026-09-21', sunday: '2026-09-27', tasks: [], routines: [], completions: new Map(), books: [], focus: [], logs: [], goals: activeGoals(lists, items) }, '2026-09-24');
  assert.match(md, /## Goals\n\n\*\*Half marathon\*\*\n- How did I move toward this, this week\?\n- Next step:/);
});

import { suggestTags } from '../src/lib/journal.js';

test('tag suggestions: prefix first, then most used', () => {
  const listed = ['book', 'film', 'travel', 'idea'];
  const counts = { book: 3, books: 1, notebook: 5, idea: 2 };
  assert.deepEqual(suggestTags('bo', listed, counts), ['book', 'books', 'notebook']);
  assert.deepEqual(suggestTags('#tr', listed, counts), ['travel']);
  assert.deepEqual(suggestTags('', listed, counts, 3), ['notebook', 'book', 'idea']);
  assert.deepEqual(suggestTags('zz', listed, counts), []);
});
