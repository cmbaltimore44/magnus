// Focus timer runs (schema_003 `focus_sessions`). Mirrors Life Tracker js/data/focus.js.
import { supabase } from '../supabase.js';

export async function listFocusSessions(sinceISO) {
  let q = supabase.from('focus_sessions').select('*');
  if (sinceISO) q = q.gte('started_at', sinceISO);
  const { data, error } = await q.order('started_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createFocusSession(userId, taskId, startedAt, minutes) {
  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({ user_id: userId, task_id: taskId, started_at: new Date(startedAt).toISOString(), minutes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function focusMinutesForTask(taskId) {
  const { data, error } = await supabase.from('focus_sessions').select('minutes').eq('task_id', taskId);
  if (error) throw error;
  return data.reduce((n, s) => n + s.minutes, 0);
}
