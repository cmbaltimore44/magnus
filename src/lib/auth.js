import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase, authStorage, offlineFetch } from './supabase.js';
import { deleteSecret } from './keychain.js';

// Returns { session, offline }. getSession() silently refreshes an expired
// access token using the stored refresh token; `offline` distinguishes
// "couldn't reach Supabase" from "the stored session is actually invalid",
// so a flaky network never bounces you to the sign-in screen.
export async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error && isAuthRetryableFetchError(error)) return { session: storedSession(), offline: true, error };
  if (error) return { session: null, offline: false, error };
  return { session: data.session, offline: false };
}

// Offline: the last saved session (possibly with an expired access token),
// so Magnus can open on cached data; supabase-js refreshes it once the
// network is back.
function storedSession() {
  try {
    const raw = authStorage?.getItem(supabase.auth.storageKey);
    const s = raw ? JSON.parse(raw) : null;
    return s?.user?.id ? s : null;
  } catch {
    return null;
  }
}

// Sign-in only: accounts are created in the Supabase dashboard, so the public
// URL and anon key can't be used to sign up.
export async function requestCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyCode(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    deleteSecret();
    offlineFetch?.clear();
  }
}

export function currentUserId(session) {
  return session?.user?.id || null;
}
