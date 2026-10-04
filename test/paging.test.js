// Tables past Supabase's 1,000-rows-per-request cap: everything still loads.
// The demo client enforces the same cap (DEMO_MAX_ROWS), so these would
// fail without paging.
import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../src/lib/supabase.js';
import { DEMO_MAX_ROWS } from '../src/lib/demo.js';
import { fetchAll } from '../src/lib/data/paging.js';
import * as tasksApi from '../src/lib/data/tasks.js';
import * as quotesApi from '../src/lib/data/quotes.js';
import * as completionsApi from '../src/lib/data/completions.js';
import { addDays, todayISO, computeStreak, COMPLETIONS_WINDOW_DAYS } from '../src/lib/data/completions.js';
import { answerFromCache } from '../src/lib/offline.js';
import { fetchSearchIndex } from '../src/lib/data/search.js';

const USER = '00000000-0000-0000-0000-000000000000';

test('the demo client caps a plain read at 1,000 rows, like Supabase', async () => {
  await supabase.from('tasks').insert(Array.from({ length: 1500 }, (_, i) => ({ user_id: USER, title: `Bulk ${i}`, status: i % 3 ? 'done' : 'todo', sort_order: 1000 + i })));
  const { data } = await supabase.from('tasks').select('*');
  assert.equal(data.length, DEMO_MAX_ROWS);
});

test('tasks: every row comes back, in order, no duplicates', async () => {
  const all = await tasksApi.listTasks();
  assert.ok(all.length > 1500, `got ${all.length}`);
  assert.equal(new Set(all.map((t) => t.id)).size, all.length);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].sort_order <= all[i].sort_order);
  // The status bar only downloads open tasks.
  const open = await tasksApi.listOpenTasks();
  assert.ok(open.length > 500 && open.every((t) => t.status !== 'done'));
  assert.equal(open.length, all.filter((t) => t.status !== 'done').length);
});

test('quotes: all of them load, per book too, and a random one is picked without loading them all', async () => {
  const { data: books } = await supabase.from('books').select('*');
  await supabase.from('quotes').insert(Array.from({ length: 1100 }, (_, i) => ({ user_id: USER, book_id: books[0].id, quote_text: `Quote ${i}`, sort_order: i })));
  const all = await quotesApi.listQuotes();
  assert.ok(all.length >= 1104);
  assert.ok((await quotesApi.listQuotesForBook(books[0].id)).length >= 1100);
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add((await quotesApi.pickRandomQuote()).id);
  assert.ok(seen.size > 1, 'random picks vary');
});

test('routine check-offs: a recent window, paged, with long streaks fetched in full', async () => {
  const today = todayISO();
  const { data: routines } = await supabase
    .from('routines')
    .insert([
      { user_id: USER, name: 'Long streak', time_of_day: 'morning', sort_order: 9 },
      { user_id: USER, name: 'Old habit', time_of_day: 'evening', sort_order: 9 },
      ...[1, 2, 3].map((n) => ({ user_id: USER, name: `Daily ${n}`, time_of_day: 'afternoon', sort_order: 9 + n })),
    ])
    .select();
  const [long, old, ...daily] = routines;
  const rows = [];
  // A 450-day streak ending today: longer than the 400-day window.
  for (let i = 0; i < 450; i++) rows.push({ user_id: USER, routine_id: long.id, completed_date: addDays(today, -i) });
  // An old run that ended long ago (outside the window, not part of a streak).
  for (let i = 500; i < 520; i++) rows.push({ user_id: USER, routine_id: old.id, completed_date: addDays(today, -i) });
  // Three routines done every day of the window: 1,200 rows, past one page.
  for (const r of daily) for (let i = 0; i < COMPLETIONS_WINDOW_DAYS; i++) rows.push({ user_id: USER, routine_id: r.id, completed_date: addDays(today, -i) });
  await supabase.from('routine_completions').insert(rows);

  const map = await completionsApi.listCompletions();
  assert.equal(computeStreak(map.get(long.id), today), 450, 'the streak is exact, beyond the window');
  assert.ok(!map.has(old.id), 'old check-offs outside the window are not downloaded');
  for (const r of daily) {
    assert.equal(map.get(r.id).size, COMPLETIONS_WINDOW_DAYS);
    assert.ok(map.get(r.id).has(today), "today's tick is there");
  }
  // Status bar: just today, no streak lookups.
  const todayOnly = await completionsApi.listCompletions({ since: today, extendStreaks: false });
  assert.ok([...todayOnly.values()].every((set) => set.size === 1 && set.has(today)));
  assert.equal(todayOnly.get(long.id).size, 1);
});

test('streakStart follows the same grace rule as computeStreak', () => {
  const t = '2026-10-04';
  assert.equal(completionsApi.streakStart(new Set(['2026-10-04', '2026-10-03', '2026-10-01']), t), '2026-10-03');
  assert.equal(completionsApi.streakStart(new Set(['2026-10-03', '2026-10-02']), t), '2026-10-02'); // today not ticked yet
  assert.equal(completionsApi.streakStart(new Set(['2026-10-01']), t), null);
});

test('fetchAll: stops on a short page, drops repeats, and fails rather than returning part of a list', async () => {
  const pages = [[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], [{ id: 4 }]];
  const fake = (fail) => {
    let n = 0;
    return () => ({ range: async () => (fail && n === 1 ? (n++, { data: null, error: new Error('page 2 failed') }) : { data: pages[n++], error: null }) });
  };
  assert.deepEqual((await fetchAll(fake(false), { pageSize: 2 })).map((r) => r.id), [1, 2, 3, 4]);
  await assert.rejects(fetchAll(fake(true), { pageSize: 2 }), /page 2 failed/);
});

test('offline: a read that was never cached is answered from the cached rows of its table', () => {
  const base = 'https://x.supabase.co/rest/v1/';
  const reads = {
    a: { url: `${base}routine_completions?select=routine_id,completed_date&completed_date=gte.2026-09-01&order=completed_date.asc&offset=0&limit=1000`, accept: 'application/json', body: [
      { routine_id: 'r1', completed_date: '2026-09-01' },
      { routine_id: 'r1', completed_date: '2026-10-03' },
      { routine_id: 'r2', completed_date: '2026-10-04' },
    ] },
    b: { url: `${base}tasks?select=*&order=sort_order.asc,id.asc&offset=0&limit=1000`, accept: 'application/json', body: [{ id: 't1', sort_order: 0 }, { id: 't2', sort_order: 1 }] },
  };
  // Tomorrow's window (a URL never seen) still answers, filtered.
  const moved = answerFromCache(reads, `${base}routine_completions?select=routine_id,completed_date&completed_date=gte.2026-09-02&order=completed_date.asc&offset=0&limit=1000`);
  assert.deepEqual(moved.map((r) => r.completed_date), ['2026-10-03', '2026-10-04']);
  // The next page of a table: empty, not an error.
  assert.deepEqual(answerFromCache(reads, `${base}tasks?select=*&order=sort_order.asc,id.asc&offset=1000&limit=1000`), []);
  // One row at a position (a random quote, say), projected to the asked columns.
  assert.deepEqual(answerFromCache(reads, `${base}tasks?select=id&order=id.asc&offset=1&limit=1`), [{ id: 't2' }]);
  // A table the cache knows nothing about: no answer.
  assert.equal(answerFromCache(reads, `${base}quotes?select=*`), null);
});

test('search covers every task and quote, not just the first 1,000', async () => {
  const index = await fetchSearchIndex();
  assert.equal(index.tasks.length, (await tasksApi.listTasks()).length);
  assert.equal(index.quotes.length, (await quotesApi.listQuotes()).length);
  assert.ok(index.tasks.some((t) => t.title === 'Bulk 1499'));
});
