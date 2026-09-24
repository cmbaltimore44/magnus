// Pure-logic tests. MAGNUS_DEMO keeps the data layer off the network/Keychain.
process.env.MAGNUS_DEMO = '1';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryColor, CATEGORY_SWATCHES } from '../src/lib/colors.js';
import { C, PALETTES, setThemeMode, mix, modeForBackground } from '../src/lib/theme.js';
import { parseDateInput } from '../src/lib/dates.js';
import { computeStreak, addDays } from '../src/lib/data/completions.js';
import { dueStatus, sortForColumn, truncate } from '../src/lib/display.js';
import { windowByHeight, windowRange, swapped } from '../src/ui/components/layout.js';
import { parseBackgroundReply } from '../src/lib/termcolors.js';
import { formatAttribution } from '../src/lib/data/quotes.js';

test('theme: palettes match, mode switching, color-mix', () => {
  assert.deepEqual(Object.keys(PALETTES.light).sort(), Object.keys(PALETTES.dark).sort());
  setThemeMode('light');
  assert.equal(C.bg, '#f2e2d6');
  setThemeMode('dark');
  assert.equal(C.bg, '#211c18');
  assert.equal(mix('#ff0000', '#0000ff', 0.25), '#4000bf');
  assert.equal(modeForBackground('#1e1e2e'), 'dark');
  assert.equal(modeForBackground('#fafafa'), 'light');
  assert.equal(modeForBackground(null), null);
});

test('categories render their stored hex; bad values fall back to muted', () => {
  setThemeMode('dark');
  assert.equal(categoryColor({ color: '#1fb6b6' }), '#1fb6b6');
  assert.equal(categoryColor({ color: 'teal' }), C.muted);
  assert.equal(categoryColor(null), C.muted);
  assert.equal(CATEGORY_SWATCHES.length, 8);
});

test('parseDateInput', () => {
  const now = new Date(2026, 8, 23); // Wed Sep 23 2026
  assert.equal(parseDateInput('', now), null);
  assert.equal(parseDateInput('today', now), '2026-09-23');
  assert.equal(parseDateInput('tomorrow', now), '2026-09-24');
  assert.equal(parseDateInput('+10', now), '2026-10-03');
  assert.equal(parseDateInput('-1', now), '2026-09-22');
  assert.equal(parseDateInput('fri', now), '2026-09-25');
  assert.equal(parseDateInput('wed', now), '2026-09-30'); // next occurrence, not today
  assert.equal(parseDateInput('10/1', now), '2026-10-01');
  assert.equal(parseDateInput('2027-02-03', now), '2027-02-03');
  assert.throws(() => parseDateInput('2026-02-30', now));
  assert.throws(() => parseDateInput('soonish', now));
});

test('computeStreak keeps the web app grace-period rule', () => {
  const today = '2026-09-23';
  const days = (n, from = today) => new Set(Array.from({ length: n }, (_, i) => addDays(from, -i)));
  assert.equal(computeStreak(days(3), today), 3);
  assert.equal(computeStreak(days(3, addDays(today, -1)), today), 3); // not yet done today
  assert.equal(computeStreak(days(3, addDays(today, -2)), today), 0);
  assert.equal(computeStreak(new Set(), today), 0);
});

test('dueStatus / board sort', () => {
  const iso = (d) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  assert.equal(dueStatus({ due_date: iso(-1), status: 'todo' }), 'overdue');
  assert.equal(dueStatus({ due_date: iso(1), status: 'todo' }), 'soon');
  assert.equal(dueStatus({ due_date: iso(5), status: 'todo' }), null);
  assert.equal(dueStatus({ due_date: iso(-1), status: 'done' }), null);
  const tasks = [
    { id: 'a', due_date: null, sort_order: 0 },
    { id: 'b', due_date: '2026-10-01', sort_order: 5 },
    { id: 'c', due_date: '2026-09-01', sort_order: 9 },
  ];
  assert.deepEqual([...tasks].sort(sortForColumn).map((t) => t.id), ['c', 'b', 'a']);
  assert.equal(truncate('hello world', 6), 'hello…');
});

test('list windowing', () => {
  assert.deepEqual(windowRange(3, 1, 10), [0, 3]);
  assert.deepEqual(windowRange(100, 50, 10), [45, 55]);
  assert.deepEqual(windowRange(100, 99, 10), [90, 100]);
  const [s, e] = windowByHeight([3, 3, 3, 3, 3], 4, 7);
  assert.ok(s <= 4 && e > 4 && e - s === 2);
  assert.deepEqual(swapped(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.equal(swapped(['a', 'b'], 0, -1), null);
});

test('parseBackgroundReply handles 2- and 4-digit channels, BEL and ST', () => {
  assert.equal(parseBackgroundReply('\x1b]11;rgb:2121/1c1c/1818\x07\x1b[?62;22c'), '#211c18');
  assert.equal(parseBackgroundReply('\x1b]11;rgb:f2/e2/d6\x1b\\'), '#f2e2d6');
  assert.equal(parseBackgroundReply('\x1b[?62;22c'), null);
});

test('formatAttribution uses the current book title', () => {
  const books = [{ id: 'b1', title: 'Middlemarch' }];
  assert.equal(formatAttribution({ book_id: 'b1', attribution: 'p. 3' }, books), 'Middlemarch - p. 3');
  assert.equal(formatAttribution({ book_id: 'b1', attribution: null }, books), 'Middlemarch');
  assert.equal(formatAttribution({ book_id: null, attribution: '— Mary Oliver' }, books), '— Mary Oliver');
});
