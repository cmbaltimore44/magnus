import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createKeychainStorage } from './keychain.js';
import { createDemoClient } from './demo.js';
import { resilientFetch } from './fetch.js';

function makeClient() {
  if (process.env.MAGNUS_DEMO) return createDemoClient();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createKeychainStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    // Retries the "JWT issued at future" race after a token refresh
    // (lib/fetch.js), and strips terminal control sequences from all data
    // before it reaches the UI (lib/sanitize.js).
    global: { fetch: resilientFetch },
  });
}

export const supabase = makeClient();
