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
