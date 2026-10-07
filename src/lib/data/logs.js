// The daily Log (schema_003 `log_entries`). Mirrors Magnus Web js/data/logs.js.
// mood/energy/sleep/weight are one per day — setDailyMetric updates the
// existing row; workouts can repeat.
import { supabase } from '../supabase.js';

export const LOG_METRICS = ['mood', 'energy', 'sleep', 'weight', 'workout'];
export const DAILY_METRICS = ['mood', 'energy', 'sleep', 'weight'];
export const LOG_LABELS = { mood: 'Mood', energy: 'Energy', sleep: 'Sleep', weight: 'Weight', workout: 'Workout' };

export async function listLogs(fromISO) {
  let q = supabase.from('log_entries').select('*');
  if (fromISO) q = q.gte('entry_date', fromISO);
  const { data, error } = await q.order('entry_date', { ascending: true });
  if (error) throw error;
  return data;
}

export function validateMetric(metric, value) {
  const n = Number(value);
  if (!LOG_METRICS.includes(metric)) throw new Error(`Unknown log metric "${metric}"`);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${LOG_LABELS[metric]} needs a number`);
  if ((metric === 'mood' || metric === 'energy') && !(Number.isInteger(n) && n >= 1 && n <= 5)) {
    throw new Error(`${LOG_LABELS[metric]} is 1–5`);
  }
  if (metric === 'sleep' && n > 24) throw new Error('Sleep is hours (0–24)');
  if (metric === 'workout' && n <= 0) throw new Error('Workout needs minutes');
  return n;
}

export async function setDailyMetric(userId, dateISO, metric, value) {
  const n = validateMetric(metric, value);
  const { data: existing, error } = await supabase
    .from('log_entries')
    .select('id')
    .eq('entry_date', dateISO)
    .eq('metric', metric);
  if (error) throw error;
  if (existing.length) {
    const { data, error: e2 } = await supabase.from('log_entries').update({ value: n }).eq('id', existing[0].id).select().single();
    if (e2) throw e2;
    return data;
  }
  const { data, error: e3 } = await supabase
    .from('log_entries')
    .insert({ user_id: userId, entry_date: dateISO, metric, value: n })
    .select()
    .single();
  if (e3) throw e3;
  return data;
}

export async function addWorkout(userId, dateISO, minutes, type) {
  const n = validateMetric('workout', minutes);
  const { data, error } = await supabase
    .from('log_entries')
    .insert({ user_id: userId, entry_date: dateISO, metric: 'workout', value: n, note: type || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLog(id) {
  const { error } = await supabase.from('log_entries').delete().eq('id', id);
  if (error) throw error;
}

// True for the PostgREST/Postgres errors a missing schema_003 produces.
export function isMissingSchema(err) {
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(err?.code);
}
