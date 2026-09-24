import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createKeychainStorage } from './keychain.js';
import { createDemoClient } from './demo.js';
import { resilientFetch } from './fetch.js';
import { makeOfflineFetch } from './offline.js';

// Real mode only: the Keychain-backed session storage and the offline layer
// (cache + write queue, lib/offline.js) on top of the retrying, sanitizing fetch.
export const authStorage = process.env.MAGNUS_DEMO ? null : createKeychainStorage();
export const offlineFetch = process.env.MAGNUS_DEMO ? null : makeOfflineFetch(resilientFetch);

function makeClient() {
  if (process.env.MAGNUS_DEMO) return createDemoClient();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    // Offline cache/queue (lib/offline.js) over the retry for the "JWT issued
    // at future" race (lib/fetch.js), which strips terminal control sequences
    // from all data before it reaches the UI (lib/sanitize.js).
    global: { fetch: offlineFetch },
  });
}

export const supabase = makeClient();
offlineFetch?.setTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token || null);
