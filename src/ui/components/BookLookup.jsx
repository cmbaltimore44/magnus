import { useState } from 'react';
import { Text } from 'ink';
import { C } from '../../lib/theme.js';
import { useAppCtx } from '../context.js';
import { Prompt, Choice } from './Prompt.jsx';
import { lookupBooks } from '../../lib/openlibrary.js';
import { cleanDeep } from '../../lib/sanitize.js';
import { truncate } from '../../lib/display.js';

// Open Library lookup: an ISBN, or title/author words → pick one → onPick(fields).
export function BookLookup({ initialQuery = '', onPick, onCancel }) {
  const { notify, columns } = useAppCtx();
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async (q) => {
    if (!q.trim()) return onCancel();
    setBusy(true);
    try {
      const found = cleanDeep(await lookupBooks(q));
      if (!found.length) {
        notify(`No Open Library match for “${q.trim()}”`, 'error');
        return onCancel();
      }
      setResults(found);
    } catch (err) {
      notify(`Open Library: ${err.message}`, 'error');
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <Text color={C.muted}>Searching Open Library…</Text>;
  if (results) {
    return (
      <Choice
        title="Open Library matches"
        options={results.map((r, i) => ({
          key: String(i),
          label: truncate(`${r.title}${r.author ? ` — ${r.author}` : ''}${r.year ? ` (${r.year})` : ''}${r.cover_image_url ? '  ▣' : ''}`, columns - 10),
          book: r,
        }))}
        onPick={(opt) => {
          const { year, ...fields } = opt.book; // eslint-disable-line no-unused-vars
          onPick(fields);
        }}
        onCancel={onCancel}
      />
    );
  }
  return (
    <Prompt
      label="ISBN or title:"
      initial={initialQuery}
      placeholder="978-0141439549 or middlemarch eliot"
      hint="looks the book up on Open Library (title, author, ISBN, cover) · esc cancel"
      onSubmit={search}
      onCancel={onCancel}
    />
  );
}
