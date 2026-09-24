import { useEffect, useState } from 'react';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Text } from 'ink';
import { C } from '../../lib/theme.js';
import { useAppCtx } from '../context.js';
import { Choice } from './Prompt.jsx';
import { parseEntries } from '../../lib/journal.js';
import { formatAttribution } from '../../lib/data/quotes.js';
import { truncate } from '../../lib/display.js';

// Markdown blockquote for a Library quote.
export function quoteMarkdown(quote, books) {
  const lines = String(quote.quote_text || '').trim().split('\n').map((l) => `> ${l}`.trimEnd());
  const attribution = formatAttribution(quote, books).replace(/^[—-]\s*/, '');
  if (attribution) lines.push(`> — ${attribution}`);
  return lines.join('\n');
}

// Send a quote to an essay: append it to an existing essay, or start a new
// one (the quote goes to the clipboard, since new-essay opens the editor itself).
export function QuoteToEssay({ quote, books, onDone }) {
  const { capture, notify, openTab, contentHeight, columns } = useAppCtx();
  const [essays, setEssays] = useState(null);

  useEffect(() => {
    capture('jlist', ['--type', 'essay', '--tsv']).then((res) => {
      if (!res.ok) notify(res.stderr.trim() || 'jlist failed', 'error');
      setEssays(res.ok ? parseEntries(res.stdout) : []);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!essays) return <Text color={C.muted}>Loading essays…</Text>;

  const book = books.find((b) => b.id === quote.book_id);
  const shown = essays.slice(0, Math.max(3, contentHeight - 6));
  const options = [
    { key: 'new', label: book ? `New essay on ${book.title}…` : 'New essay…' },
    ...shown.map((e) => ({ key: e.path, label: truncate(`${e.date}  ${e.title}`, columns - 10), entry: e })),
  ];

  const pick = async (opt) => {
    const md = quoteMarkdown(quote, books);
    onDone();
    if (!opt.entry) {
      spawnSync('pbcopy', { input: md });
      const args = book ? ['--book', book.title, ...(book.author ? ['--author', book.author] : [])] : [];
      await openTab('new-essay', args);
      return notify('Quote copied to the clipboard — paste it into the new essay', 'success');
    }
    try {
      const text = fs.readFileSync(opt.entry.path, 'utf8');
      fs.appendFileSync(opt.entry.path, `${text.endsWith('\n') ? '' : '\n'}\n${md}\n`);
    } catch (err) {
      return notify(`Couldn't add the quote: ${err.message}`, 'error');
    }
    await openTab('fresh', [opt.entry.path]);
    notify(`Added the quote to “${opt.entry.title}”`, 'success');
  };

  return <Choice title="Send quote to essay" options={options} onPick={pick} onCancel={onDone} />;
}
