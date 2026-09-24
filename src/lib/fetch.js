import { sanitizingFetch } from './sanitize.js';

// "JWT issued at future" (PostgREST error PGRST303, HTTP 401).
//
// Right after Magnus refreshes an expired session — typically the first thing
// it does when you open it after a break — it uses the brand-new access token
// within milliseconds. That token's `iat` ("issued at") comes from Supabase's
// Auth server, but it's checked by the data API (PostgREST), which has its own
// clock. If that clock is even a fraction of a second behind, the new token
// looks like it was issued in the future and the request is rejected.
//
// The request is refused before anything runs, so it's safe to retry, even
// for writes. We wait until just past the token's `iat` (read from the JWT,
// capped at a few seconds) and try again.

const MAX_RETRIES = 3;
const MAX_WAIT_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

// Seconds-since-epoch `iat` from the request's bearer token, if readable.
export function tokenIssuedAt(init) {
  const auth = headerValue(init?.headers, 'Authorization');
  const jwt = auth && /^Bearer\s+(.+)$/i.exec(auth)?.[1];
  const payload = jwt?.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof claims.iat === 'number' ? claims.iat : null;
  } catch {
    return null;
  }
}

export async function isIssuedInFuture(res) {
  if (res.status !== 401) return false;
  try {
    const body = await res.clone().json();
    return body?.code === 'PGRST303' && /issued at future/i.test(String(body?.message));
  } catch {
    return false;
  }
}

export function makeResilientFetch(baseFetch = sanitizingFetch, { now = () => Date.now(), wait = sleep } = {}) {
  return async function resilientFetch(input, init) {
    let res = await baseFetch(input, init);
    for (let attempt = 1; attempt <= MAX_RETRIES && (await isIssuedInFuture(res)); attempt++) {
      const iat = tokenIssuedAt(init);
      // Wait until a moment after `iat` by our clock (at least 500 ms, then a
      // little longer each attempt), never more than MAX_WAIT_MS.
      const untilIat = iat ? iat * 1000 - now() : 0;
      await wait(Math.min(MAX_WAIT_MS, Math.max(500 * attempt, untilIat + 500)));
      res = await baseFetch(input, init);
    }
    return res;
  };
}

export const resilientFetch = makeResilientFetch();
