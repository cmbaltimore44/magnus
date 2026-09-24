// Lists (schema_004 `lists` / `list_items`). Mirrors Life Tracker js/data/lists.js.
import { supabase } from '../supabase.js';
import { unwrap } from './_unwrap.js';

export async function listLists() {
  return unwrap(await supabase.from('lists').select('*').order('sort_order', { ascending: true }));
}

export async function listAllItems() {
  return unwrap(await supabase.from('list_items').select('*').order('sort_order', { ascending: true }));
}

export async function createList(userId, name, sortOrder) {
  return unwrap(await supabase.from('lists').insert({ user_id: userId, name, sort_order: sortOrder }).select().single());
}

export async function renameList(id, name) {
  return unwrap(await supabase.from('lists').update({ name }).eq('id', id).select().single());
}

export async function reorder(table, orderedIds) {
  await Promise.all(orderedIds.map((id, index) => supabase.from(table).update({ sort_order: index }).eq('id', id).then(unwrap)));
}

export async function createItem(userId, listId, text, sortOrder) {
  return unwrap(
    await supabase.from('list_items').insert({ user_id: userId, list_id: listId, text, sort_order: sortOrder }).select().single()
  );
}

export async function updateItem(id, fields) {
  return unwrap(await supabase.from('list_items').update(fields).eq('id', id).select().single());
}

// Adds to the end of a list (quick add `+list text`).
export async function appendItem(userId, listId, text) {
  const items = unwrap(await supabase.from('list_items').select('sort_order').eq('list_id', listId));
  const next = items.reduce((m, i) => Math.max(m, i.sort_order + 1), 0);
  return createItem(userId, listId, text, next);
}

// Only http(s) links are kept (they're opened with `open`).
export function cleanUrl(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    return u.toString();
  } catch {
    throw new Error('Link must be an http(s) URL');
  }
}
