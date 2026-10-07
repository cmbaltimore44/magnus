// Mirrors Magnus Web js/data/search.js.
import { supabase } from '../supabase.js';
import { unwrap } from './_unwrap.js';
import { fetchAll } from './paging.js';

// Tasks, books and quotes can pass Supabase's 1,000-rows-per-request cap,
// so they're read in pages (paging.js); projects and routines stay small.
export async function fetchSearchIndex() {
  const [tasks, projects, books, quotes, routines] = await Promise.all([
    fetchAll(() => supabase.from('tasks').select('id, title, notes').order('id', { ascending: true })),
    supabase.from('projects').select('id, name, notes, status').then(unwrap),
    fetchAll(() => supabase.from('books').select('id, title, author, notes').order('id', { ascending: true })),
    fetchAll(() => supabase.from('quotes').select('id, quote_text, attribution, book_id').order('id', { ascending: true })),
    supabase.from('routines').select('id, name, time_of_day').then(unwrap),
  ]);
  return { tasks, projects, books, quotes, routines };
}
