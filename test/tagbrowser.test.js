// Browse Tags (Journal g): tag counts from jlist rows plus TAGS.md.

import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntries, tagCounts } from '../src/lib/journal.js';

const TSV = [
  ['daily', '2026-10-28', 'Wed', 'work,idea', '2026-10-28', '/j/daily/2026-10-28.md'],
  ['essay', '2026-10-20', 'On walking', 'idea,book', 'on-walking', '/j/essays/on-walking.md'],
  ['note', '2026-10-01', 'Pricing', 'idea,idea', 'pricing', '/j/notes/pricing.md'],
  ['daily', '2026-09-30', 'Tue', '', '2026-09-30', '/j/daily/2026-09-30.md'],
]
  .map((r) => r.join('\t'))
  .join('\n');

test('tagCounts counts each entry once per tag, most-used first', () => {
  assert.deepEqual(tagCounts(parseEntries(TSV)), [
    { tag: 'idea', count: 3 },
    { tag: 'book', count: 1 },
    { tag: 'work', count: 1 },
  ]);
});

test('tagCounts adds TAGS.md tags with no entries and sorts by name on request', () => {
  assert.deepEqual(tagCounts(parseEntries(TSV), ['travel', 'work'], 'name'), [
    { tag: 'book', count: 1 },
    { tag: 'idea', count: 3 },
    { tag: 'travel', count: 0 },
    { tag: 'work', count: 1 },
  ]);
  assert.deepEqual(tagCounts([], ['travel']), [{ tag: 'travel', count: 0 }]);
});
