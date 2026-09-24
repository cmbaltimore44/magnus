import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createKeychainStorage } from './keychain.js';
import { createDemoClient } from './demo.js';
import { sanitizingFetch } from './sanitize.js';

function makeClient() {
  if (process.env.MAGNUS_DEMO) return createDemoClient();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createKeychainStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    // Strip terminal control sequences from all data before it reaches the UI.
    global: { fetch: sanitizingFetch },
  });
}

export const supabase = makeClient();
