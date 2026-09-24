import { toISO } from './data/completions.js';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Accepts: '' (clear), YYYY-MM-DD, MM-DD / M/D (this year), today, tomorrow,
// yesterday, +N / -N days, or a weekday name (next occurrence).
// Returns an ISO date string, null for empty, or throws on garbage.
export function parseDateInput(raw, now = new Date()) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const shift = (n) => {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };

  if (s === 'today' || s === 'tod') return shift(0);
  if (s === 'tomorrow' || s === 'tom') return shift(1);
  if (s === 'yesterday') return shift(-1);
  let m = /^([+-])(\d{1,4})d?$/.exec(s);
  if (m) return shift((m[1] === '-' ? -1 : 1) * Number(m[2]));

  const wd = WEEKDAYS.findIndex((w) => s.startsWith(w));
  if (wd >= 0 && /^[a-z]+$/.test(s)) {
    let delta = (wd - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return shift(delta);
  }

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validate(Number(m[1]), Number(m[2]), Number(m[3]), raw);
  m = /^(\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return validate(base.getFullYear(), Number(m[1]), Number(m[2]), raw);

  throw new Error(`Can't read "${raw}" as a date (try 2026-10-01, 10/1, tomorrow, +3, fri)`);
}

function validate(y, mo, d, raw) {
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new Error(`"${raw}" isn't a real date`);
  }
  return toISO(date);
}
