import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as booksApi from '../../lib/data/books.js';
import * as quotesApi from '../../lib/data/quotes.js';
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
import { Confirm } from '../components/Prompt.jsx';
import { windowRange, windowByHeight, moveIndex } from '../components/layout.js';
import { layoutQuote, QuoteRow } from '../components/Quote.jsx';

const BOOK_GROUPS = [
  { key: 'reading', label: 'Currently Reading', collapsible: false },
  { key: 'want_to_read', label: 'Want to Read', collapsible: true },
  { key: 'finished', label: 'Finished', collapsible: true },
  { key: 'dnf', label: 'Did Not Finish', collapsible: true },
];

const BOOKS_HINTS = 'tab quotes · ↑↓ move · enter open / fold group · n new book · d delete · R refresh · esc home';
const QUOTES_HINTS = 'tab books · ↑↓ move · enter edit · n new quote · f favorite · F favorites only · d delete · esc home';
const DETAIL_HINTS =
  '↑↓ highlight · a add highlight · enter edit · f favorite · d delete highlight · e edit book · v view cover · D delete book · esc back';

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
function quoteFields(context, books) {
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
    { key: 'quote_text', label: 'Quote', type: 'longtext', required: true },
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
  const { navigate, notify, userId, contentHeight, columns } = useAppCtx();
  const [tab, setTab] = useState(params?.tab === 'quotes' ? 'quotes' : 'books');
  const [openBookId, setOpenBookId] = useState(params?.bookId || null);
  const [index, setIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(() => new Set(getPref('library.collapsedGroups', ['finished', 'dnf'])));
  const [mode, setMode] = useState(null);

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
      await booksApi.deleteBook(book.id);
      setBooks((b) => b.filter((x) => x.id !== book.id));
      setOpenBookId(null);
      notify('Book deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const replaceBook = (updated) => setBooks((b) => b.map((x) => (x.id === updated.id ? updated : x)));

  useHints(openBookId ? DETAIL_HINTS : tab === 'books' ? BOOKS_HINTS : QUOTES_HINTS);

  useViewInput(
    (input, key) => {
      if (!books) return;
      if (key.escape) return navigate('home');
      if (key.tab) return setTab('quotes');
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, rows.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, rows.length));
      if (input === 'n') return setMode({ type: 'newBook' });
      if (!current) return;
      if (key.return && current.kind === 'header') return current.group.collapsible && toggleGroup(current.group.key);
      if (key.return) return setOpenBookId(current.book.id);
      if (input === 'd' && current.kind === 'book') return setMode({ type: 'confirm', book: current.book });
    },
    mode === null && !openBookId && tab === 'books'
  );

  if (!books) return <Text color={C.muted}>Loading…</Text>;

  if (mode?.type === 'newBook') {
    return (
      <Form
        title="New Book"
        fields={bookFields()}
        initial={{ status: 'want_to_read', format: 'none' }}
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
      <Text inverse={tab === 'quotes'} color={tab === 'quotes' ? C.accent : undefined}>
        {' '}
        Quotes{' '}
      </Text>
    </Text>
  );

  if (tab === 'quotes') {
    return (
      <Box flexDirection="column" height={contentHeight}>
        {tabs}
        <QuotesBrowser
          books={books}
          focusQuoteId={params?.tab === 'quotes' ? params?.quoteId : null}
          onSwitchTab={() => setTab('books')}
        />
      </Box>
    );
  }

  const budget = contentHeight - 3 - (mode ? 4 : 0);
  const [start, end] = windowRange(rows.length, index, Math.max(3, budget));
  const titleWidth = Math.max(16, Math.min(50, columns - 50));

  return (
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
          message={`Delete “${mode.book.title}” and all its highlights? This cannot be undone.`}
          onYes={() => deleteBook(mode.book)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}

function useQuoteActions({ reload, setMode }) {
  const { notify, userId } = useAppCtx();
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
        await quotesApi.deleteQuote(quote.id);
        await reload();
        notify('Quote deleted.', 'success');
      } catch (err) {
        notify(err.message, 'error');
      }
    },
  };
}

function BookDetail({ bookId, books, focusQuoteId, onBack, onUpdated, onDelete }) {
  const { notify, showCover, contentHeight, columns } = useAppCtx();
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
      if (input === 'a' || input === 'n') return setMode({ type: 'quote', quote: null });
      if (input === 'e') return setMode({ type: 'editBook' });
      if (input === 'v') return showCover(data.book.cover_image_url, data.book.title);
      if (input === 'D') return setMode({ type: 'confirmBook' });
      if (!selected) return;
      if (key.return) return setMode({ type: 'quote', quote: selected });
      if (input === 'f') return actions.toggleFavorite(selected);
      if (input === 'd') return setMode({ type: 'confirmQuote', quote: selected });
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;
  const { book } = data;

  if (mode?.type === 'editBook') {
    return <Form title="Edit Book" fields={bookFields()} initial={book} onSubmit={saveBook} onCancel={() => setMode(null)} />;
  }
  if (mode?.type === 'quote') {
    return (
      <Form
        title={mode.quote ? 'Edit Highlight' : `New Highlight — ${book.title}`}
        fields={quoteFields('book', books)}
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
          message={`Delete “${book.title}” and all its highlights? This cannot be undone.`}
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
      if (input === 'd') return setMode({ type: 'confirm', quote: selected });
    },
    mode === null
  );

  if (!quotes) return <Text color={C.muted}>Loading…</Text>;

  if (mode?.type === 'quote') {
    return (
      <Form
        title={mode.quote ? 'Edit Quote' : 'New Quote'}
        fields={quoteFields('standalone', books)}
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
