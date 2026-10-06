import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import { deleteWithUndo } from '../../lib/undo.js';
import { QuoteToEssay } from '../components/QuoteToEssay.jsx';
import { BookLookup } from '../components/BookLookup.jsx';
import { Split, splitLayout } from '../components/Split.jsx';
import { bookStats } from '../../lib/stats.js';
import { todayISO } from '../../lib/data/completions.js';
import { addWantToRead, needsDetails } from '../../lib/bookQuickAdd.js';
import { parseBookText } from '../../lib/quickadd.js';
import * as booksApi from '../../lib/data/books.js';
import * as quotesApi from '../../lib/data/quotes.js';
import { quotePrompt } from '../../lib/dictate.js';
import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  BOOK_FORMATS,
  BOOK_FORMAT_LABELS,
  BOOK_STATUS_COLORS,
  formatDue,
  plural,
  truncate,
} from '../../lib/display.js';
import { getPref, setPref } from '../../lib/prefs.js';
import { Form } from '../components/Form.jsx';
import { Prompt, Confirm } from '../components/Prompt.jsx';
import { windowRange, windowByHeight, moveIndex, swapped } from '../components/layout.js';
import { layoutQuote, QuoteRow } from '../components/Quote.jsx';

const BOOK_GROUPS = [
  { key: 'reading', label: 'Currently Reading', collapsible: false },
  { key: 'want_to_read', label: 'Want to Read', collapsible: true },
  { key: 'finished', label: 'Finished', collapsible: true },
  { key: 'dnf', label: 'Did Not Finish', collapsible: true },
];

const BOOKS_HINTS = 'tab want to read · ↑↓ move · enter open / fold group · n new book · i look up (ISBN/title) · d delete · R refresh · esc home';
const QUOTES_HINTS = 'tab stats · ↑↓ move · enter edit · n new quote · f favorite · w send to essay · F favorites only · d delete · esc home';
const STATS_HINTS = 'tab books · esc home';
const WANT_HINTS = 'tab quotes · ↑↓ move · s start reading · enter open · n add (title by author, or ISBN) · K/J reorder · f filter · d delete · esc home';
const DETAIL_HINTS =
  '↑↓ highlight · n add highlight · enter edit · f favorite · w send to essay · d delete highlight · e edit book · s start reading · i fill from Open Library · v view cover · D delete book · esc back';

const stars = (rating) => (rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '');
const fmtDate = (d) => (d ? formatDue(d) + ' ' + d.slice(0, 4) : '—');

const bookFields = () => [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'author', label: 'Author', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: BOOK_STATUSES.map((s) => ({ value: s, label: BOOK_STATUS_LABELS[s], color: C[BOOK_STATUS_COLORS[s]] })),
  },
  { key: 'format', label: 'Format', type: 'select', options: BOOK_FORMATS.map((f) => ({ value: f, label: BOOK_FORMAT_LABELS[f] })) },
  { key: 'started_date', label: 'Started', type: 'date' },
  { key: 'finished_date', label: 'Finished', type: 'date' },
  {
    key: 'rating',
    label: 'Rating',
    type: 'select',
    options: [{ value: null, label: '—' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: stars(n), color: C.accent }))],
  },
  { key: 'cover_image_url', label: 'Cover URL', type: 'text', placeholder: 'https://…' },
  { key: 'isbn', label: 'ISBN', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

// Book highlights ask for a page; standalone quotes pick a book (or none) and
// take a freer attribution — same split as the web app's quote modal.
// Dictation hints come from the quote's book (the open book, or the one picked
// in the form) and its existing quotes.
function quoteFields(context, books, { bookId, quotes = [] } = {}) {
  const dictatePrompt = (values) => {
    const id = context === 'book' ? bookId : values.book_id;
    const book = books.find((b) => b.id === id);
    return quotePrompt(book, id ? quotes.filter((q) => q.book_id === id) : quotes.slice(0, 5));
  };
  return [
    ...(context === 'book'
      ? []
      : [
          {
            key: 'book_id',
            label: 'Book',
            type: 'select',
            options: [{ value: null, label: '(standalone quote, no book)' }, ...books.map((b) => ({ value: b.id, label: b.title }))],
          },
        ]),
    { key: 'quote_text', label: 'Quote', type: 'longtext', required: true, dictatePrompt },
    {
      key: 'attribution',
      label: context === 'book' ? 'Page / location' : 'Attribution',
      type: 'text',
      placeholder: context === 'book' ? 'e.g. 177' : 'e.g. Location 177, or — Author Name',
    },
    { key: 'is_favorite', label: 'Favorite', type: 'toggle' },
  ];
}

// Lists show each quote in full, wrapped to the window, one blank line apart.
const QUOTE_GAP = 1;
const layoutsFor = (quotes, books, width) =>
  quotes.map((q) => layoutQuote(q, quotesApi.formatAttribution(q, books), width));

export function Library({ params }) {
  const { navigate, offerUndo, notify, userId, contentHeight, columns } = useAppCtx();
  const [tab, setTab] = useState(['want', 'quotes', 'stats'].includes(params?.tab) ? params.tab : 'books');
  const [openBookId, setOpenBookId] = useState(params?.bookId || null);
  const [index, setIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(() => new Set(getPref('library.collapsedGroups', ['finished', 'dnf'])));
  const [mode, setMode] = useState(params?.new ? { type: params.new } : null); // palette: newBook | lookup

  const { data: books, setData: setBooks, reload } = useLoader(() => booksApi.listBooks());

  const rows = useMemo(() => {
    if (!books) return [];
    const out = [];
    BOOK_GROUPS.forEach((group) => {
      const groupBooks = books.filter((b) => b.status === group.key);
      if (groupBooks.length === 0) return;
      const isCollapsed = group.collapsible && collapsed.has(group.key);
      out.push({ kind: 'header', group, count: groupBooks.length, isCollapsed });
      if (!isCollapsed) groupBooks.forEach((book) => out.push({ kind: 'book', book }));
    });
    return out;
  }, [books, collapsed]);

  const current = rows[Math.min(index, rows.length - 1)];

  const toggleGroup = (key) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
    setPref('library.collapsedGroups', [...next]);
  };

  const createBook = async (fields) => {
    const created = await booksApi.createBook(userId, fields, books.length);
    setBooks((b) => [created, ...b]);
    setMode(null);
    setOpenBookId(created.id);
  };

  const deleteBook = async (book) => {
    setMode(null);
    try {
      const restore = await deleteWithUndo('books', book.id);
      setBooks((b) => b.filter((x) => x.id !== book.id));
      setOpenBookId(null);
      offerUndo(`Deleted “${book.title}”`, restore);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const replaceBook = (updated) => setBooks((b) => b.map((x) => (x.id === updated.id ? updated : x)));

  useHints(openBookId ? DETAIL_HINTS : tab === 'books' ? BOOKS_HINTS : tab === 'want' ? WANT_HINTS : tab === 'quotes' ? QUOTES_HINTS : STATS_HINTS);

  useViewInput(
    (input, key) => {
      if (!books) return;
      if (key.escape) return navigate('home');
      if (key.tab) return setTab('want');
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, rows.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, rows.length));
      if (input === 'n') return setMode({ type: 'newBook' });
      if (input === 'i') return setMode({ type: 'lookup' });
      if (!current) return;
      if (key.return && current.kind === 'header') return current.group.collapsible && toggleGroup(current.group.key);
      if (key.return) return setOpenBookId(current.book.id);
      if (input === 'd' && current.kind === 'book') return setMode({ type: 'confirm', book: current.book });
    },
    mode === null && !openBookId && tab === 'books'
  );

  if (!books) return <Text color={C.muted}>Loading…</Text>;

  if (mode?.type === 'lookup') {
    return (
      <BookLookup
        onPick={(fields) => setMode({ type: 'newBook', initial: fields })}
        onCancel={() => setMode(null)}
      />
    );
  }

  if (mode?.type === 'newBook') {
    return (
      <Form
        title="New Book"
        fields={bookFields()}
        initial={{ status: 'want_to_read', format: 'none', ...mode.initial }}
        onSubmit={createBook}
        onCancel={() => setMode(null)}
      />
    );
  }

  if (openBookId) {
    return (
      <BookDetail
        bookId={openBookId}
        books={books}
        focusQuoteId={params?.bookId === openBookId ? params?.quoteId : null}
        onBack={() => setOpenBookId(null)}
        onUpdated={replaceBook}
        onDelete={deleteBook}
      />
    );
  }

  const tabs = (
    <Text>
      <Text bold>Library</Text>
      {'  '}
      <Text inverse={tab === 'books'} color={tab === 'books' ? C.accent : undefined}>
        {' '}
        Books {books.length}{' '}
      </Text>{' '}
      <Text inverse={tab === 'want'} color={tab === 'want' ? C.accent : undefined}>
        {' '}
        Want to Read {books.filter((b) => b.status === 'want_to_read').length}{' '}
      </Text>{' '}
      <Text inverse={tab === 'quotes'} color={tab === 'quotes' ? C.accent : undefined}>
        {' '}
        Quotes{' '}
      </Text>{' '}
      <Text inverse={tab === 'stats'} color={tab === 'stats' ? C.accent : undefined}>
        {' '}
        Stats{' '}
      </Text>
    </Text>
  );

  if (tab === 'want' && !openBookId) {
    return (
      <Box flexDirection="column" height={contentHeight}>
        {tabs}
        <WantToRead books={books} setBooks={setBooks} onOpen={setOpenBookId} onSwitchTab={() => setTab('quotes')} />
      </Box>
    );
  }

  if (tab === 'stats') {
    return (
      <Box flexDirection="column" height={contentHeight}>
        {tabs}
        <BookStats books={books} onSwitchTab={() => setTab('books')} />
      </Box>
    );
  }

  if (tab === 'quotes') {
    return (
      <Box flexDirection="column" height={contentHeight}>
        {tabs}
        <QuotesBrowser
          books={books}
          focusQuoteId={params?.tab === 'quotes' ? params?.quoteId : null}
          onSwitchTab={() => setTab('stats')}
        />
      </Box>
    );
  }

  const budget = contentHeight - 3 - (mode ? 4 : 0);
  const [start, end] = windowRange(rows.length, index, Math.max(3, budget));
  const layout = splitLayout(columns);
  const titleWidth = Math.max(16, Math.min(50, layout.listColumns - 50));
  const preview = current?.kind === 'book' ? <BookPreview book={current.book} width={layout.previewWidth - 4} /> : null;

  return (
    <Split layout={layout} height={contentHeight} preview={preview}>
    <Box flexDirection="column" height={contentHeight}>
      {tabs}
      <Box flexDirection="column" marginTop={1}>
        {books.length === 0 ? <Text color={C.muted}>No books yet — press n to add one.</Text> : null}
        {rows.slice(start, end).map((r, i) => {
          const isSel = start + i === index;
          if (r.kind === 'header') {
            return (
              <Text key={r.group.key} bold color={isSel ? C.accent : C[BOOK_STATUS_COLORS[r.group.key]]}>
                {isSel ? '› ' : '  '}
                {r.group.collapsible ? (r.isCollapsed ? '▸ ' : '▾ ') : '  '}
                {r.group.label} <Text color={C.muted}>({r.count})</Text>
              </Text>
            );
          }
          const b = r.book;
          return (
            <Text key={b.id} wrap="truncate-end">
              <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
              {'   '}
              <Text color={b.cover_image_url ? C.accent : C.muted}>{b.cover_image_url ? '▣' : '□'}</Text>{' '}
              <Text bold={isSel} inverse={isSel}>
                {truncate(b.title, titleWidth)}
              </Text>
              {b.author ? <Text color={C.muted}> — {b.author}</Text> : null}
              {b.format !== 'none' ? <Text color={C.muted}> · {BOOK_FORMAT_LABELS[b.format]}</Text> : null}
              {b.rating ? <Text color={C.accent}> {stars(b.rating)}</Text> : null}
            </Text>
          );
        })}
      </Box>
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete “${mode.book.title}” and all its highlights? (u undoes it)`}
          onYes={() => deleteBook(mode.book)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
    </Split>
  );
}

function useQuoteActions({ reload, setMode }) {
  const { notify, offerUndo, userId } = useAppCtx();
  return {
    toggleFavorite: async (quote) => {
      try {
        await quotesApi.updateQuote(quote.id, { is_favorite: !quote.is_favorite });
        await reload();
      } catch (err) {
        notify(err.message, 'error');
      }
    },
    save: async (existing, fields) => {
      if (existing) await quotesApi.updateQuote(existing.id, fields);
      else await quotesApi.createQuote(userId, fields, 0);
      await reload();
      setMode(null);
    },
    remove: async (quote) => {
      setMode(null);
      try {
        const restore = await deleteWithUndo('quotes', quote.id);
        await reload();
        offerUndo('Deleted quote', restore);
      } catch (err) {
        notify(err.message, 'error');
      }
    },
  };
}

function BookDetail({ bookId, books, focusQuoteId, onBack, onUpdated, onDelete }) {
  const { notify, offerUndo, showCover, contentHeight, columns } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null);

  const cached = books.find((b) => b.id === bookId);
  const { data, setData, reload } = useLoader(async () => {
    const [book, highlights] = await Promise.all([
      cached ? Promise.resolve(cached) : booksApi.getBook(bookId),
      quotesApi.listQuotesForBook(bookId),
    ]);
    return { book, highlights };
  });
  const reloadHighlights = async () => {
    const highlights = await quotesApi.listQuotesForBook(bookId);
    setData((d) => ({ ...d, highlights }));
  };
  const actions = useQuoteActions({ reload: reloadHighlights, setMode });

  const focused = useRef(false);
  useEffect(() => {
    if (!data || focused.current || !focusQuoteId) return;
    focused.current = true;
    const i = data.highlights.findIndex((q) => q.id === focusQuoteId);
    if (i >= 0) {
      setIndex(i);
      setMode({ type: 'quote', quote: data.highlights[i] });
    }
  }, [data, focusQuoteId]);

  const highlights = data?.highlights || [];
  const selected = highlights[Math.min(index, highlights.length - 1)];

  const saveBook = async (fields) => {
    const updated = await booksApi.updateBook(bookId, { ...fields, title: fields.title || 'Untitled Book' });
    setData((d) => ({ ...d, book: updated }));
    onUpdated(updated);
    setMode(null);
  };

  useViewInput(
    (input, key) => {
      if (!data) return;
      if (key.escape) return onBack();
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, highlights.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, highlights.length));
      if (input === 'n') return setMode({ type: 'quote', quote: null });
      if (input === 'e') return setMode({ type: 'editBook' });
      if (input === 'i') return setMode({ type: 'lookup' });
      if (input === 's' && data.book.status === 'want_to_read') {
        return (async () => {
          try {
            const before = { status: data.book.status, started_date: data.book.started_date };
            const updated = await booksApi.updateBook(bookId, { status: 'reading', started_date: todayISO() });
            setData((d) => ({ ...d, book: updated }));
            onUpdated(updated);
            offerUndo(`Started “${updated.title}”`, async () => {
              const back = await booksApi.updateBook(bookId, before);
              setData((d) => ({ ...d, book: back }));
              onUpdated(back);
            });
          } catch (err) {
            notify(err.message, 'error');
          }
        })();
      }
      if (input === 'v') return showCover(data.book.cover_image_url, data.book.title);
      if (input === 'D') return setMode({ type: 'confirmBook' });
      if (!selected) return;
      if (key.return) return setMode({ type: 'quote', quote: selected });
      if (input === 'f') return actions.toggleFavorite(selected);
      if (input === 'w') return setMode({ type: 'essay', quote: selected });
      if (input === 'd') return setMode({ type: 'confirmQuote', quote: selected });
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;
  const { book } = data;
  if (mode?.type === 'essay') return <QuoteToEssay quote={mode.quote} books={books} onDone={() => setMode(null)} />;
  if (mode?.type === 'lookup') {
    // Fill in what's missing: cover and ISBN always, title/author only if blank.
    return (
      <BookLookup
        initialQuery={book.isbn || [book.title, book.author].filter(Boolean).join(' ')}
        onPick={async (found) => {
          const fields = {};
          if (found.cover_image_url) fields.cover_image_url = found.cover_image_url;
          if (found.isbn) fields.isbn = found.isbn;
          if (!book.author && found.author) fields.author = found.author;
          try {
            const updated = Object.keys(fields).length ? await booksApi.updateBook(bookId, fields) : book;
            setData((d) => ({ ...d, book: updated }));
            onUpdated(updated);
            setMode(null);
            notify(`Updated from Open Library: ${Object.keys(fields).join(', ').replace(/_image_url/, '') || 'nothing new'}`, 'success');
          } catch (err) {
            notify(err.message, 'error');
            setMode(null);
          }
        }}
        onCancel={() => setMode(null)}
      />
    );
  }

  if (mode?.type === 'editBook') {
    return <Form title="Edit Book" fields={bookFields()} initial={book} onSubmit={saveBook} onCancel={() => setMode(null)} />;
  }
  if (mode?.type === 'quote') {
    return (
      <Form
        title={mode.quote ? 'Edit Highlight' : `New Highlight — ${book.title}`}
        fields={quoteFields('book', books, { bookId, quotes: data.highlights })}
        initial={mode.quote || {}}
        onSubmit={(fields) => actions.save(mode.quote, { ...fields, book_id: bookId })}
        onCancel={() => setMode(null)}
      />
    );
  }

  const coverBox = (
    <Box
      width={16}
      height={9}
      flexShrink={0}
      borderStyle="round"
      borderColor={book.cover_image_url ? C.accent : C.border}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      marginRight={2}
    >
      {book.cover_image_url ? (
        <>
          <Text color={C.accent}>▣ cover</Text>
          <Text color={C.muted}>v to view</Text>
        </>
      ) : (
        <Text color={C.muted}>no cover</Text>
      )}
    </Box>
  );

  const meta = [
    ['Author', book.author || '—'],
    ['Status', <Text color={C[BOOK_STATUS_COLORS[book.status]]}>{BOOK_STATUS_LABELS[book.status]}</Text>],
    ['Format', BOOK_FORMAT_LABELS[book.format]],
    ['Started', fmtDate(book.started_date)],
    ['Finished', fmtDate(book.finished_date)],
    ['Rating', book.rating ? <Text color={C.accent}>{stars(book.rating)}</Text> : '—'],
    ['ISBN', book.isbn || '—'],
  ];

  const qWidth = columns - 3;
  const budget = Math.max(3, contentHeight - 14 - (book.notes ? 2 : 0) - (mode ? 4 : 0));
  const layouts = layoutsFor(highlights, [], qWidth);
  const [start, end] = windowByHeight(
    layouts.map((l) => l.height + QUOTE_GAP),
    index,
    Math.max(3, budget)
  );

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text bold color={C.accent} wrap="truncate-end">
        {book.title}
      </Text>
      <Box marginTop={1}>
        {coverBox}
        <Box flexDirection="column">
          {meta.map(([label, value]) => (
            <Text key={label}>
              <Text color={C.muted}>{label.padEnd(10)}</Text>
              {value}
            </Text>
          ))}
        </Box>
      </Box>
      {book.notes ? (
        <Text wrap="truncate-end">
          <Text color={C.muted}>Notes </Text>
          {truncate(book.notes, columns * 2)}
        </Text>
      ) : null}
      <Box marginTop={1}>
        <Text bold>
          Highlights <Text color={C.muted}>{highlights.length}</Text>
        </Text>
      </Box>
      {highlights.length === 0 ? <Text color={C.muted}>  No highlights yet — press a to add one.</Text> : null}
      {highlights.slice(start, end).map((q, i) => (
        <QuoteRow
          key={q.id}
          quote={q}
          layout={layouts[start + i]}
          selected={start + i === index}
          maxLines={budget}
          gap={QUOTE_GAP}
        />
      ))}
      {mode?.type === 'confirmQuote' ? (
        <Confirm message="Delete this highlight?" onYes={() => actions.remove(mode.quote)} onNo={() => setMode(null)} />
      ) : null}
      {mode?.type === 'confirmBook' ? (
        <Confirm
          message={`Delete “${book.title}” and all its highlights? (u undoes it)`}
          onYes={() => onDelete(book)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}

function QuotesBrowser({ books, focusQuoteId, onSwitchTab }) {
  const { navigate, contentHeight, columns } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mode, setMode] = useState(null);

  const { data: quotes, reload } = useLoader(() => quotesApi.listQuotes());
  const actions = useQuoteActions({ reload, setMode });

  const visible = useMemo(
    () => (quotes ? (favoritesOnly ? quotes.filter((q) => q.is_favorite) : quotes) : []),
    [quotes, favoritesOnly]
  );
  const selected = visible[Math.min(index, visible.length - 1)];

  const focused = useRef(false);
  useEffect(() => {
    if (!quotes || focused.current || !focusQuoteId) return;
    focused.current = true;
    const i = quotes.findIndex((q) => q.id === focusQuoteId);
    if (i >= 0) {
      setIndex(i);
      setMode({ type: 'quote', quote: quotes[i] });
    }
  }, [quotes, focusQuoteId]);

  useViewInput(
    (input, key) => {
      if (!quotes) return;
      if (key.escape) return navigate('home');
      if (key.tab) return onSwitchTab();
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, visible.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, visible.length));
      if (input === 'F') {
        setIndex(0);
        return setFavoritesOnly((f) => !f);
      }
      if (input === 'n') return setMode({ type: 'quote', quote: null });
      if (!selected) return;
      if (key.return) return setMode({ type: 'quote', quote: selected });
      if (input === 'f') return actions.toggleFavorite(selected);
      if (input === 'w') return setMode({ type: 'essay', quote: selected });
      if (input === 'd') return setMode({ type: 'confirm', quote: selected });
    },
    mode === null
  );

  if (!quotes) return <Text color={C.muted}>Loading…</Text>;
  if (mode?.type === 'essay') return <QuoteToEssay quote={mode.quote} books={books} onDone={() => setMode(null)} />;

  if (mode?.type === 'quote') {
    return (
      <Form
        title={mode.quote ? 'Edit Quote' : 'New Quote'}
        fields={quoteFields('standalone', books, { quotes })}
        initial={mode.quote || {}}
        onSubmit={(fields) => actions.save(mode.quote, fields)}
        onCancel={() => setMode(null)}
      />
    );
  }

  const qWidth = columns - 3;
  const budget = Math.max(3, contentHeight - 4 - (mode ? 4 : 0));
  const layouts = layoutsFor(visible, books, qWidth);
  const [start, end] = windowByHeight(
    layouts.map((l) => l.height + QUOTE_GAP),
    index,
    Math.max(3, budget)
  );

  return (
    <Box flexDirection="column">
      <Text color={C.muted}>
        {plural(quotes.length, 'quote')}
        {favoritesOnly ? <Text color={C.accent}> · favorites only (F to show all)</Text> : ' · F favorites only'}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.length === 0 ? (
          <Text color={C.muted}>
            {favoritesOnly
              ? 'No favorite quotes yet — press f on one to star it.'
              : 'No quotes yet — press n to add one, or add highlights from a book.'}
          </Text>
        ) : null}
        {visible.slice(start, end).map((q, i) => (
          <QuoteRow
            key={q.id}
            quote={q}
            layout={layouts[start + i]}
            selected={start + i === index}
            maxLines={budget}
            gap={QUOTE_GAP}
          />
        ))}
      </Box>
      {mode?.type === 'confirm' ? (
        <Confirm message="Delete this quote?" onYes={() => actions.remove(mode.quote)} onNo={() => setMode(null)} />
      ) : null}
    </Box>
  );
}

function Bar({ n, max, width }) {
  const len = max ? Math.max(n ? 1 : 0, Math.round((n / max) * width)) : 0;
  return <Text color={C.accent}>{'█'.repeat(len)}</Text>;
}

function BookStats({ books, onSwitchTab }) {
  const { navigate, columns } = useAppCtx();
  useViewInput((input, key) => {
    if (key.escape) return navigate('home');
    if (key.tab) return onSwitchTab();
  });
  const st = bookStats(books, todayISO());
  const year = todayISO().slice(0, 4);
  const half = columns >= 100;
  const barWidth = Math.max(10, Math.floor((half ? columns / 2 : columns) - 30));
  const maxYear = Math.max(1, ...st.byYear.map(([, n]) => n));
  const maxRating = Math.max(1, ...st.ratingCounts);
  const label = (text) => <Text color={C.muted}>{text.padEnd(18)}</Text>;

  const left = (
    <Box flexDirection="column" marginRight={4} flexShrink={0}>
      <Text bold color={C.accent}>
        Overview
      </Text>
      <Text>
        {label(`Finished in ${year}`)}
        <Text bold>{st.finishedThisYear}</Text>
      </Text>
      <Text>
        {label('Finished (all)')}
        {st.finished}
      </Text>
      <Text>
        {label('Reading now')}
        {st.reading}
      </Text>
      <Text>
        {label('Want to read')}
        {st.wantToRead}
      </Text>
      <Text>
        {label('Did not finish')}
        {st.dnf}
      </Text>
      <Text>
        {label('Average rating')}
        {st.averageRating ? `${st.averageRating.toFixed(1)} ★` : '—'}
      </Text>
      <Text>
        {label('Days to finish')}
        {st.averageDays != null ? `${st.averageDays} on average` : '—'}
      </Text>
      <Box marginTop={1} flexDirection="column" flexShrink={0}>
        <Text bold color={C.accent}>
          Ratings
        </Text>
        {[5, 4, 3, 2, 1].map((n) => (
          <Text key={n}>
            <Text color={C.muted}>{`${'★'.repeat(n)}`.padEnd(6)} </Text>
            <Bar n={st.ratingCounts[n - 1]} max={maxRating} width={barWidth} /> <Text color={C.muted}>{st.ratingCounts[n - 1]}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
  const right = (
    <Box flexDirection="column" marginTop={half ? 0 : 1}>
      <Text bold color={C.accent}>
        Finished per year
      </Text>
      {st.byYear.length ? (
        st.byYear.slice(0, 8).map(([y, n]) => (
          <Text key={y}>
            <Text color={C.muted}>{y} </Text>
            <Bar n={n} max={maxYear} width={barWidth} /> <Text color={C.muted}>{n}</Text>
          </Text>
        ))
      ) : (
        <Text color={C.muted}>No finished books with a finish date yet.</Text>
      )}
      {st.byFormat.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color={C.accent}>
            By format
          </Text>
          {st.byFormat.map(([f, n]) => (
            <Text key={f}>
              {label(BOOK_FORMAT_LABELS[f] || 'Unknown')}
              {n}
            </Text>
          ))}
        </Box>
      ) : null}
      {st.topAuthors.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color={C.accent}>
            Most-read authors
          </Text>
          {st.topAuthors.map(([a, n]) => (
            <Text key={a} wrap="truncate-end">
              {a} <Text color={C.muted}>{n}</Text>
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
  return (
    <Box marginTop={1} flexDirection={half ? 'row' : 'column'} flexShrink={0}>
      {left}
      {right}
    </Box>
  );
}

// Read-only book summary for the split view.
function BookPreview({ book, width }) {
  const [quotes, setQuotes] = useState(null);
  useEffect(() => {
    let live = true;
    setQuotes(null);
    quotesApi.listQuotesForBook(book.id).then((rows) => live && setQuotes(rows), () => live && setQuotes([]));
    return () => {
      live = false;
    };
  }, [book.id]);
  const dates = [book.started_date && `started ${book.started_date}`, book.finished_date && `finished ${book.finished_date}`].filter(Boolean).join(' · ');
  return (
    <>
      <Text bold wrap="truncate-end">
        {book.title}
      </Text>
      {book.author ? <Text color={C.muted}>{book.author}</Text> : null}
      <Text>
        <Text color={C[BOOK_STATUS_COLORS[book.status]]}>{BOOK_STATUS_LABELS[book.status]}</Text>
        {book.format !== 'none' ? <Text color={C.muted}> · {BOOK_FORMAT_LABELS[book.format]}</Text> : null}
        {book.rating ? <Text color={C.accent}> {stars(book.rating)}</Text> : null}
      </Text>
      {dates ? <Text color={C.muted}>{dates}</Text> : null}
      {book.notes ? (
        <Box marginTop={1} width={width}>
          <Text wrap="wrap">{book.notes}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text color={C.muted}>{quotes ? `${quotes.length} highlight${quotes.length === 1 ? '' : 's'}` : 'Loading…'}</Text>
        {(quotes || []).slice(0, 4).map((q) => (
          <Box key={q.id} width={width} marginTop={1}>
            <Text wrap="wrap">“{truncate(q.quote_text, 240)}”</Text>
          </Box>
        ))}
      </Box>
    </>
  );
}

// Want to Read as a queue: one line per book in your own order; the first
// three are "Up next". s starts reading (status + start date, u undoes).
function WantToRead({ books, setBooks, onOpen, onSwitchTab }) {
  const { userId, navigate, notify, offerUndo, contentHeight, columns } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState('');
  const [mode, setMode] = useState(null); // add | filter | confirm
  const want = books
    .filter((b) => b.status === 'want_to_read')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
  const q = filter.toLowerCase();
  const shown = q ? want.filter((b) => `${b.title} ${b.author || ''} ${b.notes || ''}`.toLowerCase().includes(q)) : want;
  const book = shown[Math.min(index, shown.length - 1)];

  const replace = (u) => setBooks((bs) => bs.map((x) => (x.id === u.id ? u : x)));
  const run = async (fn) => {
    try {
      await fn();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const start = (b) =>
    run(async () => {
      const before = { status: b.status, started_date: b.started_date };
      const updated = await booksApi.updateBook(b.id, { status: 'reading', started_date: todayISO() });
      replace(updated);
      offerUndo(`Started “${b.title}”`, async () => replace(await booksApi.updateBook(b.id, before)));
    });

  const add = (text) =>
    run(async () => {
      const parsed = parseBookText(text);
      if (!parsed.isbn && !parsed.title) return setMode(null);
      setMode({ type: 'add', key: Date.now() }); // stays open for the next one
      const { book: created, enriched } = await addWantToRead(userId, parsed, books);
      setBooks((bs) => [created, ...bs]);
      enriched.then((u) => u && replace(u));
    });

  const reorder = (delta) =>
    run(async () => {
      if (q || !book) return q && notify('Clear the filter to reorder', 'info');
      const i = want.indexOf(book);
      const next = swapped(want, i, delta);
      if (!next) return;
      const orders = new Map(next.map((b, k) => [b.id, k]));
      setBooks((bs) => bs.map((b) => (orders.has(b.id) ? { ...b, sort_order: orders.get(b.id) } : b)));
      setIndex(i + delta);
      await Promise.all(next.map((b, k) => booksApi.updateBook(b.id, { sort_order: k })));
    });

  useViewInput(
    (input, key) => {
      if (key.escape) return filter ? setFilter('') : navigate('home');
      if (key.tab) return onSwitchTab();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, shown.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, shown.length));
      if (input === 'n') return setMode({ type: 'add', key: 0 });
      if (input === 'f') return setMode({ type: 'filter' });
      if (!book) return;
      if (input === 's') return start(book);
      if (key.return) return onOpen(book.id);
      if (input === 'K') return reorder(-1);
      if (input === 'J') return reorder(1);
      if (input === 'd') return setMode({ type: 'confirm', book });
    },
    mode === null
  );

  const promptRows = mode ? 4 : 0;
  const lines = [];
  shown.forEach((b, i) => {
    const pos = want.indexOf(b);
    if (!q && pos === 0) lines.push({ header: 'Up next' });
    if (!q && pos === 3) lines.push({ header: 'Later' });
    lines.push({ b, pos, i });
  });
  const sel = lines.findIndex((l) => l.b && l.b === book);
  const [from, to] = windowRange(lines.length, Math.max(0, sel), Math.max(3, contentHeight - 3 - promptRows));
  const titleWidth = Math.max(16, Math.floor((columns - 12) * 0.45));

  return (
    <Box flexDirection="column" marginTop={1} flexGrow={1}>
      {filter ? <Text color={C.soon}>filter: “{filter}” (esc clears)</Text> : null}
      {want.length === 0 ? <Text color={C.muted}>Nothing yet — press n, or quick add `b: Title by Author` from anywhere.</Text> : null}
      {lines.slice(from, to).map((l) =>
        l.header ? (
          <Text key={l.header} bold color={C.accent}>
            {l.header}
          </Text>
        ) : (
          <Text key={l.b.id} wrap="truncate-end">
            <Text color={C.accent}>{l.b === book ? '› ' : '  '}</Text>
            <Text color={C.muted}>{String(l.pos + 1).padStart(3)}. </Text>
            <Text bold={l.b === book} inverse={l.b === book}>
              {truncate(l.b.title, titleWidth)}
            </Text>
            {l.b.author ? <Text color={C.muted}> — {l.b.author}</Text> : null}
            {needsDetails(l.b) ? <Text color={C.soon}> ?</Text> : null}
            {l.b.notes ? <Text color={C.muted}>  {truncate(l.b.notes.split('\n')[0], 50)}</Text> : null}
          </Text>
        )
      )}
      {mode?.type === 'add' ? (
        <Prompt
          key={mode.key}
          label="Want to read:"
          placeholder="Piranesi by Susanna Clarke, or an ISBN"
          hint="enter adds and stays open · details come from Open Library when there's one clear match · esc done"
          onSubmit={add}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'filter' ? (
        <Prompt
          label="Filter:"
          initial={filter}
          hint="title, author or notes · empty clears"
          onSubmit={(v) => {
            setFilter(v.trim());
            setIndex(0);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete “${mode.book.title}”? (u undoes it)`}
          onYes={() =>
            run(async () => {
              setMode(null);
              const restore = await deleteWithUndo('books', mode.book.id);
              setBooks((bs) => bs.filter((x) => x.id !== mode.book.id));
              offerUndo(`Deleted “${mode.book.title}”`, restore);
            })
          }
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}
