// In-memory stand-in for the Supabase client, used only when MAGNUS_DEMO=1.
// It implements just the query-builder surface Magnus's data layer uses
// (select/order/eq/insert/update/delete/single), so every view can be
// exercised without touching real data or signing in.
import { randomUUID } from 'node:crypto';

const DEMO_USER = { id: '00000000-0000-4000-8000-000000000000', email: 'demo@example.com' };

function iso(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seed() {
  const u = DEMO_USER.id;
  let t = Date.now() - 1e8;
  const row = (fields) => ({ id: randomUUID(), user_id: u, created_at: new Date((t += 60000)).toISOString(), ...fields });

  const categories = [
    row({ name: 'Work', color: '#1fb6b6', sort_order: 0 }),
    row({ name: 'Home', color: '#2fa84f', sort_order: 1 }),
    row({ name: 'Health', color: '#c9463f', sort_order: 2 }),
    row({ name: 'Writing', color: '#8a4fd9', sort_order: 3 }),
  ];
  const [work, home, health, writing] = categories.map((c) => c.id);
  const tasks = [
    row({ title: 'Draft Q4 planning doc', notes: 'Pull numbers from the dashboard first', status: 'doing', category_id: work, priority: 'high', due_date: iso(1), is_starred: true, sort_order: 0 }),
    row({ title: 'Renew passport', notes: null, status: 'todo', category_id: home, priority: 'medium', due_date: iso(-2), is_starred: true, sort_order: 1 }),
    row({ title: 'Book dentist appointment', notes: null, status: 'todo', category_id: health, priority: 'low', due_date: null, is_starred: false, sort_order: 2 }),
    row({ title: 'Outline essay on Middlemarch', notes: 'Focus on Dorothea & Lydgate as parallel failures\nSecond line of notes', status: 'todo', category_id: writing, priority: 'medium', due_date: iso(6), is_starred: true, sort_order: 3 }),
    row({ title: 'Fix leaky faucet', notes: null, status: 'todo', category_id: home, priority: 'high', due_date: iso(0), is_starred: false, sort_order: 4 }),
    row({ title: 'Ship onboarding email', notes: null, status: 'done', category_id: work, priority: 'medium', due_date: iso(-1), is_starred: false, sort_order: 5 }),
    row({ title: 'Clean out garage', notes: null, status: 'done', category_id: null, priority: 'low', due_date: null, is_starred: false, sort_order: 6 }),
  ];
  const routines = [
    row({ name: 'Meditate 10 min', time_of_day: 'morning', sort_order: 0 }),
    row({ name: 'Stretch', time_of_day: 'morning', sort_order: 1 }),
    row({ name: 'Review task board', time_of_day: 'afternoon', sort_order: 0 }),
    row({ name: 'Read 30 pages', time_of_day: 'evening', sort_order: 0 }),
    row({ name: 'Journal', time_of_day: 'evening', sort_order: 1 }),
  ];
  const routine_completions = [];
  routines.forEach((r, ri) => {
    for (let d = 1; d < 200; d++) {
      const streakish = d < 3 + ri * 2 || (d * 7 + ri * 13) % 10 < 6;
      if (streakish) routine_completions.push(row({ routine_id: r.id, completed_date: iso(-d) }));
    }
  });
  routine_completions.push(row({ routine_id: routines[0].id, completed_date: iso(0) }));

  const projects = [
    row({ name: 'Kitchen renovation', status: 'in_progress', notes: 'Budget: $12k\nContractor: call back Thursday', target_date: iso(40), sort_order: 0 }),
    row({ name: 'Learn Rust', status: 'not_started', notes: null, target_date: null, sort_order: 1 }),
    row({ name: 'Launch personal site', status: 'done', notes: 'Shipped!', target_date: iso(-10), sort_order: 2 }),
  ];
  const project_tasks = [
    row({ project_id: projects[0].id, title: 'Pick cabinet finish', done: true, sort_order: 0 }),
    row({ project_id: projects[0].id, title: 'Order countertops', done: false, sort_order: 1 }),
    row({ project_id: projects[0].id, title: 'Schedule plumber', done: false, sort_order: 2 }),
    row({ project_id: projects[2].id, title: 'Buy domain', done: true, sort_order: 0 }),
  ];
  const books = [
    row({ title: 'Middlemarch', author: 'George Eliot', status: 'reading', format: 'physical', started_date: iso(-20), finished_date: null, rating: null, isbn: null, notes: null, cover_image_url: 'https://covers.openlibrary.org/b/id/8231856-L.jpg', sort_order: 0 }),
    row({ title: 'The Remains of the Day', author: 'Kazuo Ishiguro', status: 'finished', format: 'ebook', started_date: iso(-90), finished_date: iso(-70), rating: 5, isbn: null, notes: 'Devastating.', cover_image_url: null, sort_order: 1 }),
    row({ title: 'Gödel, Escher, Bach', author: 'Douglas Hofstadter', status: 'want_to_read', format: 'none', started_date: null, finished_date: null, rating: null, isbn: null, notes: null, cover_image_url: null, sort_order: 2 }),
    row({ title: 'Infinite Jest', author: 'David Foster Wallace', status: 'dnf', format: 'audiobook', started_date: iso(-200), finished_date: null, rating: 2, isbn: null, notes: null, cover_image_url: null, sort_order: 3 }),
  ];
  const quotes = [
    row({ book_id: books[0].id, attribution: 'p. 838', quote_text: 'For the growing good of the world is partly dependent on unhistoric acts.', is_favorite: true, sort_order: 0 }),
    row({ book_id: books[1].id, attribution: null, quote_text: 'What is the point of worrying oneself too much about what one could or could not have done to control the course one\'s life took?', is_favorite: false, sort_order: 0 }),
    row({ book_id: null, attribution: '— Mary Oliver', quote_text: 'Tell me, what is it you plan to do with your one wild and precious life?', is_favorite: true, sort_order: 0 }),
  ];
  return { categories, tasks, routines, routine_completions, projects, project_tasks, books, quotes };
}

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.orders = [];
    this.cols = '*';
    this.payload = null;
    this.isSingle = false;
  }
  select(cols = '*') {
    this.cols = cols;
    return this;
  }
  order(col, { ascending = true } = {}) {
    this.orders.push([col, ascending]);
    return this;
  }
  eq(col, value) {
    this.filters.push([col, value]);
    return this;
  }
  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }
  then(resolve, reject) {
    return new Promise((r) => setTimeout(r, 15)).then(() => this.exec()).then(resolve, reject);
  }
  project(rowObj) {
    if (this.cols === '*') return { ...rowObj };
    const out = {};
    for (const c of this.cols.split(',').map((s) => s.trim())) out[c] = rowObj[c];
    return out;
  }
  exec() {
    const rows = (this.db[this.table] ||= []);
    const match = (r) => this.filters.every(([c, v]) => r[c] === v);
    let result;
    if (this.op === 'insert') {
      const inserted = { id: randomUUID(), created_at: new Date().toISOString(), ...this.payload };
      const clash =
        this.table === 'routine_completions' &&
        rows.some((r) => r.routine_id === inserted.routine_id && r.completed_date === inserted.completed_date);
      if (clash) return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
      rows.push(inserted);
      result = [inserted];
    } else if (this.op === 'update') {
      result = rows.filter(match);
      result.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      const doomed = new Set(rows.filter(match));
      this.db[this.table] = rows.filter((r) => !doomed.has(r));
      this.cascade(doomed);
      result = [...doomed];
    } else {
      result = rows.filter(match);
      for (const [col, asc] of [...this.orders].reverse()) {
        result = [...result].sort((a, b) => {
          const av = a[col] ?? '';
          const bv = b[col] ?? '';
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return asc ? cmp : -cmp;
        });
      }
    }
    result = result.map((r) => this.project(r));
    if (this.isSingle) {
      if (result.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: result[0], error: null };
    }
    return { data: result, error: null };
  }
  cascade(doomed) {
    const ids = new Set([...doomed].map((r) => r.id));
    const db = this.db;
    if (this.table === 'routines') db.routine_completions = db.routine_completions.filter((c) => !ids.has(c.routine_id));
    if (this.table === 'projects') db.project_tasks = db.project_tasks.filter((c) => !ids.has(c.project_id));
    if (this.table === 'books') db.quotes = db.quotes.filter((q) => !ids.has(q.book_id));
    if (this.table === 'categories') db.tasks.forEach((t) => ids.has(t.category_id) && (t.category_id = null));
  }
}

export function createDemoClient() {
  const db = seed();
  const session = { access_token: 'demo', refresh_token: 'demo', user: DEMO_USER };
  return {
    from: (table) => new Query(db, table),
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
      stopAutoRefresh: () => {},
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}
