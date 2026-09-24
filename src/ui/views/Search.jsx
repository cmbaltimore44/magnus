import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppCtx, useCapture } from '../context.js';
import { fetchSearchIndex } from '../../lib/data/search.js';
import { PROJECT_STATUS_LABELS, TIME_OF_DAY_LABELS, truncate } from '../../lib/display.js';
import { windowRange } from '../components/layout.js';

// Port of Life Tracker's Cmd+K palette (js/search.js): same index, same
// ranking (title matches first), same per-group cap.
const TYPE_ORDER = ['task', 'project', 'book', 'quote', 'routine'];
const TYPE_LABELS = { task: 'Tasks', project: 'Projects', book: 'Books', quote: 'Quotes', routine: 'Routines' };
const MAX_PER_GROUP = 8;

function buildIndex({ tasks, projects, books, quotes, routines }) {
  const items = [];
  tasks.forEach((t) =>
    items.push({ type: 'task', id: t.id, title: t.title, subtitle: t.notes || '', searchText: `${t.title} ${t.notes || ''}`.toLowerCase(), raw: t })
  );
  projects.forEach((p) =>
    items.push({
      type: 'project',
      id: p.id,
      title: p.name,
      subtitle: PROJECT_STATUS_LABELS[p.status] || '',
      searchText: `${p.name} ${p.notes || ''}`.toLowerCase(),
      raw: p,
    })
  );
  books.forEach((b) =>
    items.push({
      type: 'book',
      id: b.id,
      title: b.title,
      subtitle: b.author || '',
      searchText: `${b.title} ${b.author || ''} ${b.notes || ''}`.toLowerCase(),
      raw: b,
    })
  );
  quotes.forEach((q) =>
    items.push({
      type: 'quote',
      id: q.id,
      title: q.quote_text,
      subtitle: q.attribution || '',
      searchText: `${q.quote_text} ${q.attribution || ''}`.toLowerCase(),
      raw: q,
    })
  );
  routines.forEach((r) =>
    items.push({ type: 'routine', id: r.id, title: r.name, subtitle: TIME_OF_DAY_LABELS[r.time_of_day] || '', searchText: r.name.toLowerCase(), raw: r })
  );
  return items;
}

function search(index, term) {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  TYPE_ORDER.forEach((type) => {
    index
      .filter((item) => item.type === type && item.searchText.includes(q))
      .sort((a, b) => (a.title.toLowerCase().includes(q) ? 0 : 1) - (b.title.toLowerCase().includes(q) ? 0 : 1))
      .slice(0, MAX_PER_GROUP)
      .forEach((item) => results.push(item));
  });
  return results;
}

export function Search({ onClose }) {
  useCapture();
  const { navigate, notify, setHints, contentHeight, columns } = useAppCtx();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(null);
  const [active, setActive] = useState(0);
  // Set directly: useHints() deliberately stays quiet while search is open.
  useEffect(() => setHints('type to search · ↑↓ select · enter open · esc close'), [setHints]);

  useEffect(() => {
    fetchSearchIndex()
      .then((raw) => setIndex(buildIndex(raw)))
      .catch((err) => {
        notify(err.message, 'error');
        setIndex([]);
      });
  }, [notify]);

  const results = useMemo(() => (index ? search(index, query) : []), [index, query]);
  const selected = results[Math.min(active, results.length - 1)];

  const open = (item) => {
    if (item.type === 'task') navigate('board', { taskId: item.id, edit: true });
    else if (item.type === 'project') navigate('projects', { projectId: item.id });
    else if (item.type === 'book') navigate('library', { bookId: item.id });
    else if (item.type === 'quote')
      navigate('library', item.raw.book_id ? { bookId: item.raw.book_id, quoteId: item.id } : { tab: 'quotes', quoteId: item.id });
    else if (item.type === 'routine') navigate('routines', { routineId: item.id });
  };

  useInput((_input, key) => {
    if (key.escape) return onClose();
    if (key.upArrow) return setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    if (key.downArrow || key.tab) return setActive((i) => (results.length ? (i + 1) % results.length : 0));
  });

  // Rows: each result is one line; group labels add a line each.
  const [start, end] = windowRange(results.length, active, Math.max(3, contentHeight - 12));
  const shown = results.slice(start, end);
  const width = columns - 8;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} height={contentHeight + 1}>
      <Box>
        <Text color="magenta" bold>
          Search{' '}
        </Text>
        <TextInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActive(0);
          }}
          onSubmit={() => selected && open(selected)}
          placeholder="tasks, projects, books, quotes, routines…"
        />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {!index ? <Text dimColor>Loading…</Text> : null}
        {index && !query.trim() ? <Text dimColor>Start typing to search tasks, projects, books, quotes, and routines.</Text> : null}
        {index && query.trim() && results.length === 0 ? <Text dimColor>No matches.</Text> : null}
        {shown.map((item, i) => {
          const abs = start + i;
          const showLabel = abs === 0 || results[abs - 1].type !== item.type || i === 0;
          const isSel = abs === Math.min(active, results.length - 1);
          return (
            <Box key={`${item.type}-${item.id}`} flexDirection="column">
              {showLabel ? (
                <Text bold color="cyan">
                  {TYPE_LABELS[item.type]}
                </Text>
              ) : null}
              <Text wrap="truncate-end">
                <Text color="magenta">{isSel ? '› ' : '  '}</Text>
                <Text bold={isSel} inverse={isSel}>
                  {truncate(item.title, Math.floor(width * 0.6))}
                </Text>
                {item.subtitle ? <Text dimColor> {truncate(item.subtitle, Math.floor(width * 0.35))}</Text> : null}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
