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
