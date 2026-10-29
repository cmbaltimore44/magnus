// Apply the Ask Magnus proposals the user accepted, and build one restore()
// that reverses all of them (fed to the app's `u` undo). Stops at the first
// failure: what was applied before it stays applied, and is still undoable.
import * as tasksApi from '../data/tasks.js';
import * as logsApi from '../data/logs.js';
import { supabase } from '../supabase.js';
import { unwrap } from '../data/_unwrap.js';

async function applyOne(userId, p) {
  if (p.kind === 'create_task') {
    const row = await tasksApi.createTask(userId, { notes: null, status: 'todo', ...p.fields }, p.sortOrder);
    return () => tasksApi.deleteTask(row.id);
  }
  if (p.kind === 'update_task') {
    if (p.before.status === 'done' && p.changes.status && p.changes.status !== 'done') {
      // Out of Done: a repeating task's untouched next copy goes away and its rule comes back.
      const done = unwrap(await supabase.from('tasks').select('*').eq('id', p.id).single());
      await tasksApi.reopenTask(done, p.changes);
      return () => tasksApi.updateTask(p.id, p.before);
    }
    const row = await tasksApi.updateTask(p.id, p.changes);
    // Finishing a repeating task spawned its next copy: undo takes that back too.
    if (p.changes.status === 'done') return () => tasksApi.reopenTask(row, p.before);
    return () => tasksApi.updateTask(p.id, p.before);
  }
  if (p.kind === 'log') {
    if (p.metric === 'workout') {
      const row = await logsApi.addWorkout(userId, p.date, p.value, p.note);
      return () => logsApi.deleteLog(row.id);
    }
    const prior = unwrap(await supabase.from('log_entries').select('id, value').eq('entry_date', p.date).eq('metric', p.metric));
    const row = await logsApi.setDailyMetric(userId, p.date, p.metric, p.value);
    return prior.length ? () => logsApi.setDailyMetric(userId, p.date, p.metric, prior[0].value) : () => logsApi.deleteLog(row.id);
  }
  throw new Error(`unknown change ${p.kind}`);
}

/** → { applied, error, restore } */
export async function applyProposals(userId, proposals) {
  const undo = [];
  let error = null;
  for (const p of proposals) {
    try {
      undo.push(await applyOne(userId, p));
    } catch (err) {
      error = new Error(`${p.label}: ${err.message}`);
      break;
    }
  }
  const restore = async () => {
    for (const fn of [...undo].reverse()) await fn();
  };
  return { applied: undo.length, error, restore };
}
