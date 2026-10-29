// `magnus day close|open`: mark today closed (or not) in Supabase, so the
// close-the-day nudge (schema_007) doesn't fire. `today --close` calls it;
// Magnus Web has the same switch ("Done for today").
import { supabase } from './lib/supabase.js';
import { unwrap } from './lib/data/_unwrap.js';
import { isMissingSchema } from './lib/data/logs.js';

export const DAY_HELP = `magnus day — the close-the-day nudge

  magnus day close   mark today closed (no "Close the day?" push tonight)
  magnus day open    undo that
`;

// "Today" in the time zone the notifications use, so the Mac and the
// database agree on which day it is.
export async function notifyDay(userId, now = new Date()) {
  let zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const s = unwrap(await supabase.from('assistant_settings').select('timezone').eq('user_id', userId).maybeSingle());
    if (s?.timezone) zone = s.timezone;
  } catch {
    // no settings yet: the Mac's zone
  }
  return now.toLocaleDateString('en-CA', { timeZone: zone }); // YYYY-MM-DD
}

export async function runDay(args, { userId, out = (s) => process.stdout.write(s) }) {
  const [cmd] = args;
  if (!cmd || cmd === '--help' || cmd === 'help') {
    out(DAY_HELP);
    return 0;
  }
  if (cmd !== 'close' && cmd !== 'open') throw new Error(`unknown day command "${cmd}" (see magnus day --help)`);
  const day = await notifyDay(userId);
  try {
    unwrap(
      await supabase
        .from('assistant_days')
        .upsert({ user_id: userId, day, closed_at: cmd === 'close' ? new Date().toISOString() : null })
    );
  } catch (err) {
    if (isMissingSchema(err)) throw new Error('needs supabase/schema_007.sql (Magnus Web repo)');
    throw err;
  }
  out(cmd === 'close' ? `Closed ${day}: no close-the-day nudge tonight.\n` : `Reopened ${day}.\n`);
  return 0;
}
