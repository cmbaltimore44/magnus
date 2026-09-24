// Exercises the real `security` CLI against a throwaway service name, never
// the real "magnus-session" item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSecret, writeSecret, deleteSecret, createKeychainStorage } from '../src/lib/keychain.js';

const SERVICE = `magnus-test-${process.pid}`;

test('keychain round-trip and storage adapter', { skip: process.platform !== 'darwin' }, () => {
  try {
    assert.equal(readSecret(SERVICE), null);
    const big = JSON.stringify({ token: 'x'.repeat(6000), quote: 'a "quoted" \\ value' });
    writeSecret(big, SERVICE);
    assert.equal(readSecret(SERVICE), big);

    deleteSecret(SERVICE);
    const storage = createKeychainStorage(SERVICE);
    assert.equal(storage.getItem('sb-auth'), null);
    storage.setItem('sb-auth', '{"refresh_token":"r1"}');
    storage.setItem('sb-auth', '{"refresh_token":"r2"}'); // rotation overwrites (-U)
    assert.equal(createKeychainStorage(SERVICE).getItem('sb-auth'), '{"refresh_token":"r2"}');
    storage.removeItem('sb-auth');
    assert.equal(readSecret(SERVICE), null); // empty store deletes the item
  } finally {
    deleteSecret(SERVICE);
  }
});

test('values on both sides of the stdin line limit survive intact', { skip: process.platform !== 'darwin' }, () => {
  try {
    for (const n of [100, 2600, 2700, 5000, 20000]) {
      const v = 'y'.repeat(n);
      writeSecret(v, SERVICE);
      assert.equal(readSecret(SERVICE), v, `length ${n}`);
    }
  } finally {
    deleteSecret(SERVICE);
  }
});
