import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, cleanDeep, sanitizingFetch } from '../src/lib/sanitize.js';

test('cleanText strips escape sequences and stray controls, keeps text', () => {
  assert.equal(cleanText('plain text\nline two\tok'), 'plain text\nline two\tok');
  assert.equal(cleanText('a\x1b]8;;http://evil\x1b\\link\x1b]8;;\x1b\\b'), 'alinkb'); // OSC 8 hyperlink
  assert.equal(cleanText('a\x1b]52;c;SGVsbG8=\x07b'), 'ab'); // clipboard write
  assert.equal(cleanText('a\x1b[2J\x1b[31mb'), 'ab'); // CSI
  assert.equal(cleanText('a\x1b_Ga=T;data\x1b\\b'), 'ab'); // APC (kitty graphics)
  assert.equal(cleanText('a\x07\bb\x9b31mc'), 'ab31mc'); // BEL, backspace, C1 CSI
  assert.equal(cleanText('a\r\nb\rc'), 'a\nb\nc');
  assert.equal(cleanText('Gödel, Escher — “Bach” 🎵'), 'Gödel, Escher — “Bach” 🎵');
  assert.equal(cleanText('one\ntwo', { keepNewlines: false }), 'one two');
});

test('cleanDeep cleans nested rows and leaves other types alone', () => {
  const rows = [{ id: 1, title: 'x\x1b[1my', done: true, notes: null, tags: ['a\x07'] }];
  assert.deepEqual(cleanDeep(rows), [{ id: 1, title: 'xy', done: true, notes: null, tags: ['a'] }]);
});

test('sanitizingFetch cleans JSON bodies and passes others through', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      url === 'json'
        ? new Response(JSON.stringify([{ title: 'hi\u001b]8;;x\u001b\\there' }]), { status: 200, headers: { 'content-type': 'application/json', 'content-length': '99' } })
        : url === 'empty'
          ? new Response(null, { status: 204, headers: { 'content-type': 'application/json' } })
          : new Response('\x1b[31mraw', { status: 200, headers: { 'content-type': 'text/plain' } });
    assert.deepEqual(await (await sanitizingFetch('json')).json(), [{ title: 'hithere' }]);
    assert.equal((await sanitizingFetch('empty')).status, 204);
    assert.equal(await (await sanitizingFetch('text')).text(), '\x1b[31mraw');
  } finally {
    globalThis.fetch = realFetch;
  }
});
