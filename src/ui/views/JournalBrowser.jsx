import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import { C } from '../../lib/theme.js';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt, Confirm } from '../components/Prompt.jsx';
import { windowRange, moveIndex } from '../components/layout.js';
import { parseEntries, findBacklinks, moveToTrash, journalDir } from '../../lib/journal.js';
import { truncate } from '../../lib/display.js';
import { Split, splitLayout } from '../components/Split.jsx';
import fs from 'node:fs';
import { cleanText } from '../../lib/sanitize.js';

// Every journal entry (daily, essays, notes), newest first — the list comes
// from the `jlist --tsv` script, so Magnus and the command line agree.
const FILTERS = ['all', 'daily', 'essay', 'note'];
const FILTER_LABELS = { all: 'All', daily: 'Daily', essay: 'Essays', note: 'Notes' };
const TYPE_COLORS = { daily: 'soon', essay: 'accent', note: 'success' };
const HINTS = '↑↓ move · enter open · t tags · d move to Trash · tab type · f filter · R refresh · esc back';

export function JournalBrowser({ onBack, openEntry }) {
  const { capture, run, notify, contentHeight, columns: fullColumns } = useAppCtx();
  const layout = splitLayout(fullColumns);
  const columns = layout.listColumns;
  const [entries, setEntries] = useState(null);
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // null | {type:'filter'} | {type:'confirm', entry, links}
  useHints(HINTS);

  const load = async () => {
    const res = await capture('jlist', ['--tsv']);
    if (!res.ok) {
      notify(res.stderr.trim() || 'jlist failed', 'error');
      setEntries([]);
      return;
    }
    setEntries(parseEntries(res.stdout));
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = text.toLowerCase();
    return (entries || []).filter(
      (e) =>
        (filter === 'all' || e.type === filter) &&
        (!q || `${e.title} ${e.tags.join(' ')} ${e.slug}`.toLowerCase().includes(q))
    );
  }, [entries, filter, text]);
  const selected = visible[Math.min(index, visible.length - 1)];

  const trash = async (entry) => {
    setMode(null);
    try {
      await moveToTrash(entry.path);
      setEntries((list) => list.filter((e) => e.path !== entry.path));
      notify(`Moved ${path.relative(journalDir(), entry.path)} to the Trash`, 'success');
    } catch (err) {
      notify(`Couldn't move it to the Trash: ${err.message}`, 'error');
    }
  };

  useViewInput(
    (input, key) => {
      if (key.escape) {
        if (text) return setText('');
        return onBack();
      }
      if (!entries) return;
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, visible.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, visible.length));
      if (key.pageUp) return setIndex((i) => moveIndex(i, -10, visible.length));
      if (key.pageDown) return setIndex((i) => moveIndex(i, 10, visible.length));
      if (key.tab) {
        setIndex(0);
        return setFilter((f) => FILTERS[(FILTERS.indexOf(f) + 1) % FILTERS.length]);
      }
      if (input === 'f') return setMode({ type: 'filter' });
      if (input === 'R') return load();
      if (!selected) return;
      if (key.return || input === 'o') return openEntry(selected.path);
      // jtag's checklist runs right here (it's quick), then the list reloads.
      if (input === 't') return run('jtag', [selected.path], { pause: 'auto' }).then(load);
      if (input === 'd') return setMode({ type: 'confirm', entry: selected, links: findBacklinks(selected.slug, selected.path) });
    },
    mode === null
  );

  if (!entries) return <Text color={C.muted}>Loading entries…</Text>;

  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? entries.length : entries.filter((e) => e.type === f).length]));
  const listHeight = Math.max(3, contentHeight - 4 - (mode ? 5 : 0));
  const [start, end] = windowRange(visible.length, index, listHeight);
  const titleWidth = Math.max(16, columns - 34);

  const selectedEntry = visible[Math.min(index, visible.length - 1)];
  return (
    <Split layout={layout} height={contentHeight} preview={selectedEntry ? <EntryPreview entry={selectedEntry} height={contentHeight - 2} /> : null}>
    <Box flexDirection="column" height={contentHeight}>
      <Text wrap="truncate-end">
        <Text bold>Journal entries</Text>
        {'  '}
        {FILTERS.map((f) => (
          <Text key={f} inverse={f === filter} color={f === filter ? C.accent : C.muted}>
            {' '}
            {FILTER_LABELS[f]} {counts[f]}{' '}
          </Text>
        ))}
        {text ? <Text color={C.soon}>  filter: “{text}” (esc clears)</Text> : null}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.length === 0 ? <Text color={C.muted}>No entries{text || filter !== 'all' ? ' match' : ' yet'}.</Text> : null}
        {visible.slice(start, end).map((e, i) => {
          const isSel = start + i === index;
          return (
            <Text key={e.path} wrap="truncate-end">
              <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
              <Text color={C.muted}>{(e.date || '----------').padEnd(11)}</Text>
              <Text color={C[TYPE_COLORS[e.type]]}>{e.type.padEnd(6)}</Text>
              <Text bold={isSel} inverse={isSel}>
                {truncate(e.title, titleWidth)}
              </Text>
              {e.tags.length ? <Text color={C.muted}> [{e.tags.join(', ')}]</Text> : null}
            </Text>
          );
        })}
      </Box>
      {mode?.type === 'filter' ? (
        <Prompt
          label="Filter:"
          initial={text}
          hint="matches title, tags and slug · empty clears · esc cancel"
          onSubmit={(v) => {
            setText(v.trim());
            setIndex(0);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={
            `Move ${path.relative(journalDir(), mode.entry.path)} to the Trash?` +
            (mode.links.length
              ? `\n  ${mode.links.length} entr${mode.links.length === 1 ? 'y links' : 'ies link'} to [[${mode.entry.slug}]]: ${mode.links.join(', ')}`
              : '')
          }
          onYes={() => trash(mode.entry)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
    </Split>
  );
}

// First screenful of the entry's Markdown (front matter dimmed).
function EntryPreview({ entry, height }) {
  let lines;
  try {
    lines = cleanText(fs.readFileSync(entry.path, 'utf8')).split('\n').slice(0, Math.max(1, height));
  } catch (err) {
    return <Text color={C.danger}>{err.message}</Text>;
  }
  let fence = 0;
  return lines.map((line, i) => {
    if (line === '---' && fence < 2 && (i === 0 || fence === 1)) fence++;
    const inFront = fence === 1 || (fence === 2 && line === '---');
    return (
      <Text key={i} wrap="truncate-end" color={inFront ? C.muted : line.startsWith('#') ? C.accent : undefined} bold={line.startsWith('#')}>
        {line || ' '}
      </Text>
    );
  });
}
