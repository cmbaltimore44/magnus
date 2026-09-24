import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { KEYCHAIN_SERVICE } from './config.js';

// Thin wrapper over macOS's built-in `security` CLI — no native npm module.
// Values are base64-encoded so arbitrary JSON survives `security`'s own
// quoting rules. Writes prefer `security -i` on stdin so the token doesn't
// appear in the process list, but -i silently truncates lines past ~4 KB, so
// larger values fall back to `-w <value>` argv (on macOS only processes of
// your own user can read another process's arguments). Every write is read
// back and verified.

const ACCOUNT = os.userInfo().username;

export function readSecret(service = KEYCHAIN_SERVICE) {
  try {
    const out = execFileSync('security', ['find-generic-password', '-a', ACCOUNT, '-s', service, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Buffer.from(out.trim(), 'base64').toString('utf8');
  } catch {
    return null; // exit 44 = no such item
  }
}

const STDIN_LINE_LIMIT = 3500;

export function writeSecret(value, service = KEYCHAIN_SERVICE) {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  if (encoded.length <= STDIN_LINE_LIMIT) {
    execFileSync('security', ['-i'], {
      input: `add-generic-password -a "${ACCOUNT}" -s "${service}" -w "${encoded}" -U\n`,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  } else {
    execFileSync('security', ['add-generic-password', '-a', ACCOUNT, '-s', service, '-w', encoded, '-U'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  }
  if (readSecret(service) !== value) {
    throw new Error(`Keychain write for "${service}" didn't verify`);
  }
}

export function deleteSecret(service = KEYCHAIN_SERVICE) {
  try {
    execFileSync('security', ['delete-generic-password', '-a', ACCOUNT, '-s', service], {
      stdio: 'ignore',
    });
  } catch {
    // already gone
  }
}

// A supabase-js `auth.storage` adapter backed by a single Keychain item.
// supabase-js calls setItem on every token refresh (refresh tokens rotate),
// so the Keychain copy always holds the latest usable session.
export function createKeychainStorage(service = KEYCHAIN_SERVICE) {
  let cache = {};
  const raw = readSecret(service);
  if (raw) {
    try {
      cache = JSON.parse(raw);
    } catch {
      cache = {};
    }
  }

  const persist = () => {
    if (Object.keys(cache).length === 0) deleteSecret(service);
    else writeSecret(JSON.stringify(cache), service);
  };

  return {
    getItem: (key) => (key in cache ? cache[key] : null),
    setItem: (key, value) => {
      if (cache[key] === value) return;
      cache[key] = value;
      persist();
    },
    removeItem: (key) => {
      if (!(key in cache)) return;
      delete cache[key];
      persist();
    },
  };
}
