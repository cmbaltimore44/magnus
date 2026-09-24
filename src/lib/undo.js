// Delete with undo: snapshot a row plus whatever the delete cascades to,
// delete it, and return a function that puts everything back with the same
// ids. Mirrors Life Tracker js/undo.js.
import { supabase } from './supabase.js';
import { unwrap } from './data/_unwrap.js';
import { isMissingSchema } from './data/logs.js';

// Children removed (cascade) or detached (set null) by deleting a row.
const CASCADES = {
  routines: [{ table: 'routine_completions', key: 'routine_id', kind: 'cascade' }],
  projects: [{ table: 'project_tasks', key: 'project_id', kind: 'cascade' }],
  books: [{ table: 'quotes', key: 'book_id', kind: 'cascade' }],
  lists: [{ table: 'list_items', key: 'list_id', kind: 'cascade' }],
  categories: [{ table: 'tasks', key: 'category_id', kind: 'detach' }],
  tasks: [{ table: 'focus_sessions', key: 'task_id', kind: 'detach' }],
};

async function selectChildren(table, key, id) {
  try {
    return unwrap(await supabase.from(table).select('*').eq(key, id));
  } catch (err) {
    if (isMissingSchema(err)) return []; // focus_sessions before schema_003
    throw err;
  }
}

export async function deleteWithUndo(table, id) {
  const row = unwrap(await supabase.from(table).select('*').eq('id', id).single());
  const children = [];
  for (const rel of CASCADES[table] || []) {
    children.push({ ...rel, rows: await selectChildren(rel.table, rel.key, id) });
  }
  unwrap(await supabase.from(table).delete().eq('id', id));

  return async function restore() {
    unwrap(await supabase.from(table).insert(row));
    for (const rel of children) {
      if (!rel.rows.length) continue;
      if (rel.kind === 'cascade') {
        unwrap(await supabase.from(rel.table).insert(rel.rows));
      } else {
        await Promise.all(
          rel.rows.map((r) => supabase.from(rel.table).update({ [rel.key]: id }).eq('id', r.id).then(unwrap))
        );
      }
    }
    return row;
  };
}
