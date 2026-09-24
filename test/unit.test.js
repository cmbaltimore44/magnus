// Pure-logic tests. MAGNUS_DEMO keeps the data layer off the network/Keychain.

import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToAnsi, categoryColor, CATEGORY_SWATCHES } from '../src/lib/colors.js';
import { C } from '../src/lib/theme.js';
import { parseDateInput } from '../src/lib/dates.js';
import { computeStreak, addDays } from '../src/lib/data/completions.js';
import { dueStatus, sortForColumn, truncate } from '../src/lib/display.js';
import { windowByHeight, windowRange, swapped } from '../src/ui/components/layout.js';
import { parsePaletteReplies } from '../src/lib/palette.js';
import { formatAttribution } from '../src/lib/data/quotes.js';
import { tagLinkFlags } from '../src/lib/journal.js';

test('theme tokens are named ANSI colors (the terminal theme supplies RGB)', () => {
  for (const [k, v] of Object.entries(C)) {
    if (v !== undefined) assert.match(v, /^[a-z]+(Bright)?$/, k);
  }
  assert.ok(['redBright', 'magenta'].includes(C.accent));
});

test('every web-app swatch maps to its own distinct ANSI slot', () => {
  for (const s of CATEGORY_SWATCHES) assert.equal(hexToAnsi(s.hex), s.ansi, s.label);
  assert.equal(new Set(CATEGORY_SWATCHES.map((s) => hexToAnsi(s.hex))).size, CATEGORY_SWATCHES.length);
  assert.equal(categoryColor({ color: '#1fb6b6' }), 'cyan');
  assert.equal(categoryColor(null), 'white');
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

test('parsePaletteReplies handles 2- and 4-digit channels, BEL and ST', () => {
  const buf = '\x1b]4;9;rgb:e2e2/7070/3f3f\x07\x1b]4;3;rgb:e0/a8/3a\x1b\\\x1b[?62;22c';
  assert.deepEqual(parsePaletteReplies(buf), { 9: '#e2703f', 3: '#e0a83a' });
});

test('formatAttribution uses the current book title', () => {
  const books = [{ id: 'b1', title: 'Middlemarch' }];
  assert.equal(formatAttribution({ book_id: 'b1', attribution: 'p. 3' }, books), 'Middlemarch - p. 3');
  assert.equal(formatAttribution({ book_id: 'b1', attribution: null }, books), 'Middlemarch');
  assert.equal(formatAttribution({ book_id: null, attribution: '— Mary Oliver' }, books), '— Mary Oliver');
});

test('tagLinkFlags turns the tags/links answer into flags', () => {
  assert.deepEqual(tagLinkFlags('idea Work #book [[pricing ideas]] [[2026-09-23]]'), [
    '--tag', 'idea', '--tag', 'Work', '--tag', 'book', '--link', 'pricing ideas', '--link', '2026-09-23',
  ]);
  assert.deepEqual(tagLinkFlags(''), []);
  assert.deepEqual(tagLinkFlags('  #  '), []);
});

test('journal browser helpers: parse jlist rows, find backlinks', async () => {
  const { parseEntries, findBacklinks } = await import('../src/lib/journal.js');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const rows = parseEntries('note\t2026-09-22\tPricing: ideas\tidea,work\tpricing-ideas\t/j/notes/pricing-ideas.md\n\ndaily\t2026-09-23\tDaily entry 2026-09-23\t\t2026-09-23\t/j/daily/x.md\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].tags, ['idea', 'work']);
  assert.deepEqual(rows[1].tags, []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-journal-'));
  try {
    fs.mkdirSync(path.join(dir, 'notes'));
    fs.writeFileSync(path.join(dir, 'a.md'), 'see [[pricing-ideas]]');
    fs.writeFileSync(path.join(dir, 'b.md'), 'see [[pricing-ideas|pricing]]');
    fs.writeFileSync(path.join(dir, 'c.md'), 'see [[pricing-ideas-old]]');
    const self = path.join(dir, 'notes', 'pricing-ideas.md');
    fs.writeFileSync(self, 'self link [[pricing-ideas]]');
    assert.deepEqual(findBacklinks('pricing-ideas', self, dir), ['a.md', 'b.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
