// Shared pure display helpers — ports of Life Tracker js/taskDisplay.js plus
// the label maps each web view defines, so Magnus and the web app never
// disagree about what's overdue or how a status is spelled.

export const TASK_STATUSES = ['todo', 'doing', 'done'];
export const TASK_STATUS_LABELS = { todo: 'To Do', doing: 'In Progress', done: 'Done' };
export const PRIORITIES = ['low', 'medium', 'high'];
export const PROJECT_STATUSES = ['not_started', 'in_progress', 'done'];
export const PROJECT_STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', done: 'Done' };
export const TIME_OF_DAY = ['morning', 'afternoon', 'evening'];
export const TIME_OF_DAY_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
export const BOOK_STATUSES = ['want_to_read', 'reading', 'finished', 'dnf'];
export const BOOK_STATUS_LABELS = {
  want_to_read: 'Want to Read',
  reading: 'Currently Reading',
  finished: 'Finished',
  dnf: 'Did Not Finish',
};
export const BOOK_FORMATS = ['none', 'physical', 'ebook', 'audiobook'];
export const BOOK_FORMAT_LABELS = { none: '—', physical: 'Physical', ebook: 'Ebook', audiobook: 'Audiobook' };

// Theme token names (keys of `C` in lib/theme.js), matching how the web
// app's style.css colors each state. Resolve with C[token] at render time.
export const PRIORITY_COLORS = { high: 'danger', medium: 'soon', low: 'muted' };
export const DUE_COLORS = { overdue: 'overdue', soon: 'soon' };
export const PROJECT_STATUS_COLORS = { not_started: 'muted', in_progress: 'accent', done: 'soon' };
export const BOOK_STATUS_COLORS = { reading: 'accent', want_to_read: 'text', finished: 'success', dnf: 'muted' };

export function getCategory(categories, categoryId) {
  return categories.find((c) => c.id === categoryId) || null;
}

export function dueStatus(task) {
  if (!task.due_date || task.status === 'done') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date + 'T00:00:00');
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 1) return 'soon';
  return null;
}

export function formatDue(dateStr) {
  const due = new Date(dateStr + 'T00:00:00');
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dueLabel(task) {
  if (!task.due_date) return '';
  const status = dueStatus(task);
  return (status === 'overdue' ? 'Overdue · ' : '') + formatDue(task.due_date);
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function truncate(text, width) {
  if (!text) return '';
  const oneLine = String(text).replace(/\s*\n\s*/g, ' ');
  if (width <= 1) return oneLine.slice(0, Math.max(0, width));
  return oneLine.length > width ? oneLine.slice(0, width - 1) + '…' : oneLine;
}

// Board sort order, identical to the web board's column sort.
export function sortForColumn(a, b) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.sort_order - b.sort_order;
}
