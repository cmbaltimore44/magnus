import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { deleteSecret } from './keychain.js';

// Returns { session, offline }. getSession() silently refreshes an expired
// access token using the stored refresh token; `offline` distinguishes
// "couldn't reach Supabase" from "the stored session is actually invalid",
// so a flaky network never bounces you to the sign-in screen.
export async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error && isAuthRetryableFetchError(error)) return { session: null, offline: true, error };
  if (error) return { session: null, offline: false, error };
  return { session: data.session, offline: false };
}

export async function requestCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
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
  }
}

export function currentUserId(session) {
  return session?.user?.id || null;
}
