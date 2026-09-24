import { useEffect, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';
import os from 'node:os';
import path from 'node:path';
import { canOpenGhosttyTabs, openInGhosttyTab } from '../../lib/ghostty.js';
import { cleanText } from '../../lib/sanitize.js';
import { tagLinkFlags, checkinFlags, todayEntryHasCheckin } from '../../lib/journal.js';
import { JournalBrowser } from './JournalBrowser.jsx';
import { InboxTriage } from './InboxTriage.jsx';
import { CalendarHeatmap } from '../components/Heatmap.jsx';
import { parseEntries, writingStreak, entriesByDate } from '../../lib/journal.js';
import { todayISO } from '../../lib/data/completions.js';
import { plural } from '../../lib/display.js';

// Front door to the journal scripts already on $PATH. Magnus doesn't
// reimplement any of their logic — it just launches them, handing over the
// terminal for the interactive ones.
//
// Note on New Book/Film Essay: `new-essay` does NOT prompt for a missing
// --book/--film value (a bare `--book` hits `$2: unbound variable` under
// `set -u`, and `--film ""` silently makes a plain essay). So Magnus asks for
// just that title and passes it along; the script's own prompts still handle
// the essay title, author and director.
//
// Items marked `tab: true` (starting an entry) open in a new Ghostty tab so
// Magnus stays up in this one; elsewhere they take over this terminal.
export const ITEMS = [
  { key: 't', label: "Today's Entry", desc: 'today [--mood --energy --sleep]', action: { run: 'today', tab: true, checkin: true } },
  { key: 'o', label: 'Close the Day', desc: 'today --close (Evening section)', action: { run: 'today', args: ['--close'], tab: true } },
  { key: 'e', label: 'New Essay', desc: 'new-essay [--tag …] [--link …]', action: { run: 'new-essay', tab: true, tags: true } },
  { key: 'b', label: 'New Book Essay', desc: 'new-essay --book … [--tag …] [--link …]', action: { prompt: 'Book title:', run: 'new-essay', flag: '--book', tab: true, tags: true } },
  { key: 'f', label: 'New Film Essay', desc: 'new-essay --film … [--tag …] [--link …]', action: { prompt: 'Film title:', run: 'new-essay', flag: '--film', tab: true, tags: true } },
  { key: 's', label: 'Search', desc: 'jsearch <text> · #tag → jsearch -t <tag>', action: { search: true } },
  { key: 'g', label: 'Tags', desc: 'jtags', action: { output: 'jtags' } },
  { key: 'k', label: 'Backlinks', desc: 'jbacklinks <slug>', action: { prompt: 'Slug:', run: 'jbacklinks', placeholder: 'note-slug' } },
  { key: 'v', label: 'Graph', desc: 'jgraph (opens in browser)', action: { quick: 'jgraph' } },
  { key: 'c', label: 'Quick Capture', desc: 'capture "…" → inbox.md', action: { capture: true } },
  { key: 'r', label: 'Triage Inbox', desc: 'each item → task · note · essay · delete', action: { triage: true } },
  { key: 'i', label: 'Edit Inbox', desc: 'fresh inbox.md', action: { run: 'fresh', tab: true, inbox: true } },
  { key: 'n', label: 'New Note', desc: 'new-note "…" [--tag …] [--link …]', action: { note: true, run: 'new-note', tab: true, tags: true } },
  { key: 'x', label: 'Note from Inbox', desc: 'new-note --from-inbox', action: { run: 'new-note', args: ['--from-inbox'], tab: true } },
  { key: 'w', label: 'Weekly Review', desc: 'jweek → reviews/YYYY-Www.md', action: { run: 'jweek', tab: true } },
  { key: 'l', label: 'Browse Entries', desc: 'jlist · every daily/essay/note: open or delete', action: { browse: true } },
  { key: 'd', label: 'Back Up to Drive', desc: 'journal-backup (plug in the drive first)', action: { backup: true } },
];


// Same location the `capture` script appends to.
function inboxPath() {
  return path.join(process.env.JOURNAL_DIR || path.join(os.homedir(), 'journal'), 'inbox.md');
}

const HINTS = 'press a letter or ↑↓ enter · esc home';

export function Journal({ params }) {
  const { navigate, notify, run, capture, contentHeight, columns } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // {type:'prompt', item, step?, title?} | {type:'output', title, lines, offset}
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    // Writing streak + heatmap; refreshed whenever we come back to the menu.
    if (mode !== null) return;
    capture('jlist', ['--tsv']).then((res) => setEntries(res.ok ? parseEntries(res.stdout) : []));
  }, [mode === null]); // eslint-disable-line react-hooks/exhaustive-deps
  useHints(mode?.type === 'browse' || mode?.type === 'triage' ? null : mode?.type === 'output' ? '↑↓ scroll · esc back' : HINTS);

  const start = async (a, args) => {
    if (a.tab && canOpenGhosttyTabs()) {
      try {
        await openInGhosttyTab(a.run, args);
        return notify(`Opened ${[a.run, ...args].join(' ')} in a new Ghostty tab`, 'success');
      } catch (err) {
        notify(`Couldn't open a Ghostty tab (${err.message}) — running here instead`, 'error');
      }
    }
    return run(a.run, args);
  };

  const launch = async (item, value) => {
    const a = item.action;
    if (a.inbox) return start(a, [inboxPath()]);
    if (a.backup) {
      notify('Backing up the journal to the drive…', 'info');
      const res = await capture('journal-backup', []);
      const msg = cleanText((res.stdout.trim() || res.stderr.trim()).split('\n').pop() || '', { keepNewlines: false });
      return notify(msg || (res.ok ? 'Journal backed up.' : 'Backup failed.'), res.ok ? 'success' : 'error');
    }
    if (a.checkin) {
      try {
        return start(a, checkinFlags(value));
      } catch (err) {
        return notify(err.message, 'error');
      }
    }
    if (a.run && !a.prompt) return start(a, a.args || []);
    if (a.run && a.prompt) {
      if (!value.trim()) return;
      return start(a, a.flag ? [a.flag, value.trim()] : [value.trim()]);
    }
    if (a.search) {
      const q = value.trim();
      if (!q) return;
      // "#tag" searches tags; anything else is full-text.
      if (q.startsWith('#') && q.length > 1) return run('jsearch', ['-t', q.slice(1)]);
      return run('jsearch', [q]);
    }
    if (a.capture) {
      const text = value.trim();
      if (!text) return;
      const res = await capture('capture', [text]);
      return notify(cleanText(res.ok ? res.stdout.trim() || 'Captured.' : res.stderr.trim() || 'capture failed', { keepNewlines: false }), res.ok ? 'success' : 'error');
    }
    if (a.output) {
      const res = await capture(a.output, []);
      const text = cleanText(res.stdout + (res.stderr ? `\n${res.stderr}` : '')).replace(/\s+$/, '');
      return setMode({ type: 'output', title: item.label, lines: text ? text.split('\n') : ['(no output)'], offset: 0 });
    }
    if (a.quick) {
      notify(`Running ${a.quick}…`, 'info');
      const res = await capture(a.quick, []);
      return notify(cleanText((res.ok ? res.stdout : res.stderr || res.stdout).trim(), { keepNewlines: false }) || `${a.quick} done`, res.ok ? 'success' : 'error');
    }
  };

  // Entries with `tags: true` end with an optional "Tags / links" step.
  // New Note asks for its title first; book/film essays for the book/film
  // title; New Essay goes straight to tags (new-essay asks for its own title).
  const submitWithTags = (item, value) => {
    const a = item.action;
    if (mode.step !== 'tags') {
      if (!value.trim()) return setMode(null);
      const base = a.note ? [value.trim()] : [a.flag, value.trim()];
      return setMode({ type: 'prompt', item, step: 'tags', base });
    }
    setMode(null);
    start(a, [...(mode.base || []), ...tagLinkFlags(value)]);
  };

  const choose = (item) => {
    const a = item.action;
    // Mood/energy/sleep once a day: skipped when today's entry already has them.
    if (a.checkin) return todayEntryHasCheckin() ? launch(item, '') : setMode({ type: 'prompt', item });
    if (a.tags && !a.prompt && !a.note) setMode({ type: 'prompt', item, step: 'tags', base: [] });
    else if (a.browse) setMode({ type: 'browse' });
    else if (a.triage) setMode({ type: 'triage' });
    else if (a.prompt || a.search || a.capture || a.note) setMode({ type: 'prompt', item });
    else launch(item, '');
  };

  // Arriving from the command palette with an item to run.
  const handledParams = useRef(false);
  useEffect(() => {
    if (handledParams.current || !params?.item) return;
    handledParams.current = true;
    const item = ITEMS.find((it) => it.key === params.item);
    if (item) {
      setIndex(ITEMS.indexOf(item));
      choose(item);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useViewInput(
    (input, key) => {
      if (mode?.type === 'output') {
        const max = Math.max(0, mode.lines.length - (contentHeight - 3));
        if (key.escape) return setMode(null);
        if (key.upArrow || input === 'k') return setMode({ ...mode, offset: Math.max(0, mode.offset - 1) });
        if (key.downArrow || input === 'j') return setMode({ ...mode, offset: Math.min(max, mode.offset + 1) });
        if (key.pageUp) return setMode({ ...mode, offset: Math.max(0, mode.offset - 10) });
        if (key.pageDown) return setMode({ ...mode, offset: Math.min(max, mode.offset + 10) });
        return;
      }
      if (key.escape) return navigate('home');
      const direct = ITEMS.find((it) => it.key === input);
      if (direct) {
        setIndex(ITEMS.indexOf(direct));
        return choose(direct);
      }
      if (key.upArrow) return setIndex((i) => (i - 1 + ITEMS.length) % ITEMS.length);
      if (key.downArrow) return setIndex((i) => (i + 1) % ITEMS.length);
      if (key.return) return choose(ITEMS[index]);
    },
    mode === null || mode.type === 'output'
  );

  if (mode?.type === 'browse') {
    return <JournalBrowser onBack={() => setMode(null)} openEntry={(file) => start({ run: 'fresh', tab: true }, [file])} />;
  }

  if (mode?.type === 'triage') return <InboxTriage onBack={() => setMode(null)} start={start} />;

  if (mode?.type === 'output') {
    const size = contentHeight - 3;
    const from = Math.min(mode.offset, Math.max(0, mode.lines.length - size));
    return (
      <Box flexDirection="column" height={contentHeight}>
        <Text bold color={C.accent}>
          {mode.title} <Text color={C.muted}>{mode.lines.length} lines</Text>
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {mode.lines.slice(from, from + size).map((line, i) => (
            <Text key={from + i} wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  const promptItem = mode?.type === 'prompt' ? mode.item : null;
  const promptProps = promptItem
    ? promptItem.action.checkin
      ? { label: 'Mood energy sleep:', placeholder: '4 3 7.5', hint: 'optional · mood and energy 1–5, hours slept · - skips one · enter to start the entry' }
      : promptItem.action.search
      ? { label: 'Search journal:', hint: 'text for full-text search · #tag for a tag search · esc cancel' }
      : promptItem.action.capture
        ? { label: 'Capture:', hint: 'appends a timestamped line to inbox.md · esc cancel' }
        : mode.step === 'tags'
          ? {
              label: 'Tags / links:',
              placeholder: 'idea work [[some-slug]]',
              hint:
                'optional · space-separated tags, [[slug]] adds a Related link · enter to ' +
                (promptItem.action.note ? 'create' : 'start (the script asks for the essay title)'),
            }
          : promptItem.action.note
            ? { label: 'Note title:', hint: 'enter to continue · esc cancel' }
            : {
                label: promptItem.action.prompt,
                placeholder: promptItem.action.placeholder,
                hint: promptItem.action.tags ? 'enter to continue · esc cancel' : undefined,
              }
    : null;

  const streak = entries ? writingStreak(entries, todayISO()) : 0;
  const counts = entries ? entriesByDate(entries) : new Map();
  const month = todayISO().slice(0, 7);
  const thisMonth = entries ? entries.filter((e) => e.date?.startsWith(month)).length : 0;
  const menuWidth = 2 + 4 + 18 + Math.max(...ITEMS.map((it) => it.desc.length));
  // The heatmap goes beside the menu when there's room, else below it, else it's left out.
  const side = columns - 4 - menuWidth - 2 >= 40;
  const below = !side && contentHeight >= ITEMS.length + 2 + 11 + (promptItem ? 4 : 0);
  const heatmap = entries?.length ? (
    <CalendarHeatmap
      title="Writing"
      columns={side ? columns - 4 - menuWidth - 2 : columns - 4}
      maxWeeks={side ? 26 : 53}
      levelFor={(iso) => Math.min(4, counts.get(iso) || 0)}
      footer={(active, weeks) => `${plural(active, 'day')} with an entry in the last ${weeks} weeks`}
    />
  ) : null;

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text bold>
        Journal{' '}
        {entries ? (
          <Text color={C.muted}>
            {streak ? <Text color={C.accent}>✎ {streak}-day streak</Text> : 'no daily streak yet'} · {thisMonth} {thisMonth === 1 ? 'entry' : 'entries'} this month
          </Text>
        ) : null}
      </Text>
      <Box flexDirection="row">
      <Box flexDirection="column" marginTop={1} flexShrink={0}>
        {ITEMS.map((item, i) => (
          <Text key={item.key}>
            <Text color={C.accent}>{i === index ? '› ' : '  '}</Text>
            <Text color={C.accent} bold>
              [{item.key}]
            </Text>{' '}
            <Text bold={i === index}>{item.label.padEnd(18)}</Text>
            <Text color={C.muted}>{item.desc}</Text>
          </Text>
        ))}
      </Box>
      {side && heatmap ? (
        <Box marginTop={1} marginLeft={2}>
          {heatmap}
        </Box>
      ) : null}
      </Box>
      {below && heatmap && !promptItem ? <Box marginTop={1}>{heatmap}</Box> : null}
      {promptItem ? (
        <Box marginTop={1}>
          <Prompt
            key={mode.step || 'first'}
            {...promptProps}
            onSubmit={(v) => {
              if (promptItem.action.tags) return submitWithTags(promptItem, v);
              setMode(null);
              launch(promptItem, v);
            }}
            onCancel={() => setMode(null)}
          />
        </Box>
      ) : null}
    </Box>
  );
}
