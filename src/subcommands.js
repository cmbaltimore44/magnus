// Non-interactive `magnus context` / `magnus log`, called by the journal
// scripts (`today`, `jweek`). They never prompt: without a saved session or a
// network they print an error to stderr and exit 1, and the script carries on
// without Magnus data.
import { restoreSession, currentUserId } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { todayISO } from './lib/data/completions.js';
import { parseDateInput } from './lib/dates.js';
import { isoWeek } from './lib/stats.js';
import { loadDay, formatDay, loadWeek, formatWeek, loadClose, formatClose } from './lib/digest.js';
import * as logsApi from './lib/data/logs.js';
import { runTimer } from './timerCommand.js';
import { cleanText } from './lib/sanitize.js';
import { runTutor } from './tutorCommand.js';

export const SUBCOMMANDS = ['context', 'log', 'timer', 'tutor'];

function parseFlags(args, known) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !known.includes(name)) throw new Error(`unknown option ${args[i]}`);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new Error(`${args[i]} needs a value`);
    out[name] = args[++i];
  }
  return out;
}

async function session() {
  const { session: s, error } = await restoreSession();
  if (!s) throw new Error(error ? `can't reach Supabase (${error.message})` : 'not signed in — run magnus once to sign in');
  return s;
}

export async function runSubcommand(name, args) {
  // Scripts wait on us; never hang them on a stalled network.
  // `magnus tutor` streams answers and may start the backend: no limit there. `magnus timer`
  // writes the timer first and logs focus time after, so give a slow sign-in room to finish.
  const limit = name === 'tutor' ? null : name === 'timer' ? 25000 : 12000;
  const timer = limit && setTimeout(() => {
    process.stderr.write(`magnus ${name}: timed out\n`);
    process.exit(1);
  }, limit);
  try {
    if (name === 'timer') return await runTimer(args);
    if (name === 'tutor') return await runTutor(args);
    if (name === 'context') {
      const close = args.includes('--close');
      const flags = parseFlags(args.filter((a) => a !== '--close'), ['date', 'week']);
      await session();
      if (close) {
        const date = flags.date ? parseDateInput(flags.date) : todayISO();
        process.stdout.write(formatClose(await loadClose(date), date));
      } else if (flags.week) {
        const label = flags.week === 'this' ? isoWeek(todayISO()) : flags.week;
        process.stdout.write(formatWeek(await loadWeek(label), todayISO()));
      } else {
        const date = flags.date ? parseDateInput(flags.date) : todayISO();
        process.stdout.write(formatDay(await loadDay(), date));
      }
      return 0;
    }
    if (name === 'log') {
      const flags = parseFlags(args, ['date', 'mood', 'energy', 'sleep', 'weight', 'workout', 'type']);
      const date = flags.date ? parseDateInput(flags.date) : todayISO();
      // Validate everything before writing anything.
      for (const m of logsApi.LOG_METRICS) if (flags[m] != null) logsApi.validateMetric(m, flags[m]);
      if (flags.type && !flags.workout) throw new Error('--type goes with --workout');
      const userId = currentUserId(await session());
      const written = [];
      for (const m of logsApi.DAILY_METRICS) {
        if (flags[m] == null) continue;
        await logsApi.setDailyMetric(userId, date, m, flags[m]);
        written.push(`${m} ${flags[m]}`);
      }
      if (flags.workout) {
        await logsApi.addWorkout(userId, date, flags.workout, flags.type);
        written.push(`workout ${flags.workout} min`);
      }
      process.stdout.write(written.length ? `Logged ${written.join(', ')} for ${date}\n` : '');
      return 0;
    }
    return 1;
  } catch (err) {
    const hint = logsApi.isMissingSchema(err) ? ' (run supabase/schema_003.sql)' : '';
    process.stderr.write(`magnus ${name}: ${cleanText(String(err.message), { keepNewlines: false })}${hint}\n`);
    return 1;
  } finally {
    clearTimeout(timer);
    supabase.auth.stopAutoRefresh?.();
  }
}
