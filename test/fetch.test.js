import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResilientFetch, tokenIssuedAt } from '../src/lib/fetch.js';

const jwt = (claims) =>
  ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');
const future = () =>
  new Response(JSON.stringify({ code: 'PGRST303', details: null, hint: null, message: 'JWT issued at future' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
const ok = () => new Response('[{"id":1}]', { status: 200, headers: { 'content-type': 'application/json' } });

test('tokenIssuedAt reads iat from the bearer token (Headers or plain object)', () => {
  assert.equal(tokenIssuedAt({ headers: { Authorization: `Bearer ${jwt({ iat: 1700000000 })}` } }), 1700000000);
  assert.equal(tokenIssuedAt({ headers: new Headers({ authorization: `Bearer ${jwt({ iat: 42 })}` }) }), 42);
  assert.equal(tokenIssuedAt({ headers: {} }), null);
  assert.equal(tokenIssuedAt({ headers: { Authorization: 'Bearer not-a-jwt' } }), null);
});

test('retries "JWT issued at future", waiting until just past iat', async () => {
  const calls = [];
  const waits = [];
  let n = 0;
  const base = async (input, init) => {
    calls.push(input);
    return ++n < 3 ? future() : ok();
  };
  const now = 1_700_000_000_000; // ms
  const f = makeResilientFetch(base, { now: () => now, wait: async (ms) => waits.push(ms) });
  const init = { headers: { Authorization: `Bearer ${jwt({ iat: now / 1000 + 1 })}` } }; // issued 1s "ahead"
  const res = await f('https://x/rest/v1/tasks', init);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [{ id: 1 }]);
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [1500, 1500]); // until iat + 500 ms (more than the 500/1000 ms minimum)
});

test('gives up after a few retries and returns the error response', async () => {
  let n = 0;
  const f = makeResilientFetch(async () => (n++, future()), { wait: async () => {} });
  const res = await f('u', {});
  assert.equal(res.status, 401);
  assert.equal(n, 4); // first try + 3 retries
});

test('other 401s and normal responses pass straight through', async () => {
  let n = 0;
  const expired = () =>
    new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
  const f = makeResilientFetch(async () => (n++, expired()), { wait: async () => assert.fail('should not wait') });
  assert.equal((await f('u', {})).status, 401);
  assert.equal(n, 1);
  const g = makeResilientFetch(async () => ok(), { wait: async () => assert.fail('should not wait') });
  assert.equal((await g('u', {})).status, 200);
});
