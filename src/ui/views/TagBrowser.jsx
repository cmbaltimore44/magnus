import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { C } from '../../lib/theme.js';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';
import { windowRange, moveIndex } from '../components/layout.js';
import { parseEntries, listedTags, tagCounts } from '../../lib/journal.js';
import { truncate } from '../../lib/display.js';
import { Split, splitLayout } from '../components/Split.jsx';
import { EntryPreview } from './JournalBrowser.jsx';

// Every tag with its entry count (from `jlist --tsv`, plus TAGS.md tags not
// used yet). enter shows a tag's entries; there enter opens one and t retags
// it with jtag. On wide windows the right pane shows the highlighted tag's
// entries, or the highlighted entry's first screenful.
const TYPE_COLORS = { daily: 'soon', essay: 'accent', note: 'success' };
const TAG_HINTS = '↑↓ move · enter entries · f filter · s sort · R refresh · esc back';
const ENTRY_HINTS = '↑↓ move · enter open · t tags · ← back to tags · esc back';
const entryCount = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

export function TagBrowser({ onBack, openEntry }) {
  const { capture, run, notify, contentHeight, columns: fullColumns } = useAppCtx();
  const layout = splitLayout(fullColumns);
  const columns = layout.listColumns;
  const [entries, setEntries] = useState(null);
  const [listed, setListed] = useState([]);
  const [sort, setSort] = useState('count');
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [openTag, setOpenTag] = useState(null); // tag whose entries are listed
  const [entryIndex, setEntryIndex] = useState(0);
  const [filtering, setFiltering] = useState(false);
  useHints(openTag ? ENTRY_HINTS : TAG_HINTS);

  const load = async () => {
    setListed(listedTags());
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

  const allTags = useMemo(() => tagCounts(entries || [], listed, sort), [entries, listed, sort]);
  const tags = useMemo(() => {
    const q = text.toLowerCase();
    return allTags.filter((t) => !q || t.tag.toLowerCase().includes(q));
  }, [allTags, text]);
  const selectedTag = tags[Math.min(index, tags.length - 1)];
  const tagged = (tag) => (tag ? (entries || []).filter((e) => e.tags.includes(tag)) : []);
  const openEntries = tagged(openTag);
  const selectedEntry = openEntries[Math.min(entryIndex, openEntries.length - 1)];

  useViewInput(
    (input, key) => {
      if (!entries) return key.escape && onBack();
      if (openTag) {
        if (key.escape || key.leftArrow) return setOpenTag(null);
        if (key.upArrow || input === 'k') return setEntryIndex((i) => moveIndex(i, -1, openEntries.length));
        if (key.downArrow || input === 'j') return setEntryIndex((i) => moveIndex(i, 1, openEntries.length));
        if (key.pageUp) return setEntryIndex((i) => moveIndex(i, -10, openEntries.length));
        if (key.pageDown) return setEntryIndex((i) => moveIndex(i, 10, openEntries.length));
        if (!selectedEntry) return;
        if (key.return) return openEntry(selectedEntry.path);
        // jtag's checklist runs right here (it's quick), then the counts reload.
        if (input === 't') return run('jtag', [selectedEntry.path], { pause: 'auto' }).then(load);
        return;
      }
      if (key.escape) {
        if (text) {
          setIndex(0);
          return setText('');
        }
        return onBack();
      }
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, tags.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, tags.length));
      if (key.pageUp) return setIndex((i) => moveIndex(i, -10, tags.length));
      if (key.pageDown) return setIndex((i) => moveIndex(i, 10, tags.length));
      if (input === 'f') return setFiltering(true);
      if (input === 'R') return load();
      if (input === 's') {
        setIndex(0);
        return setSort((s) => (s === 'count' ? 'name' : 'count'));
      }
      if ((key.return || key.rightArrow) && selectedTag) {
        if (!selectedTag.count) return notify(`No entries tagged ${selectedTag.tag} yet`, 'info');
        setEntryIndex(0);
        return setOpenTag(selectedTag.tag);
      }
    },
    !filtering
  );

  if (!entries) return <Text color={C.muted}>Loading tags…</Text>;

  const listHeight = Math.max(3, contentHeight - 4 - (filtering ? 5 : 0));

  if (openTag) {
    const [start, end] = windowRange(openEntries.length, entryIndex, listHeight);
    const titleWidth = Math.max(16, columns - 34);
    return (
      <Split layout={layout} height={contentHeight} preview={selectedEntry ? <EntryPreview entry={selectedEntry} height={contentHeight - 2} /> : null}>
        <Box flexDirection="column" height={contentHeight}>
          <Text wrap="truncate-end">
            <Text bold color={C.accent}>
              {openTag}
            </Text>
            <Text color={C.muted}> {entryCount(openEntries.length)}</Text>
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {openEntries.length === 0 ? <Text color={C.muted}>No entries carry this tag any more.</Text> : null}
            {openEntries.slice(start, end).map((e, i) => {
              const isSel = start + i === entryIndex;
              return (
                <Text key={e.path} wrap="truncate-end">
                  <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
                  <Text color={C.muted}>{(e.date || '----------').padEnd(11)}</Text>
                  <Text color={C[TYPE_COLORS[e.type]]}>{e.type.padEnd(6)}</Text>
                  <Text bold={isSel} inverse={isSel}>
                    {truncate(e.title, titleWidth)}
                  </Text>
                  {e.tags.length > 1 ? <Text color={C.muted}> [{e.tags.filter((t) => t !== openTag).join(', ')}]</Text> : null}
                </Text>
              );
            })}
          </Box>
        </Box>
      </Split>
    );
  }

  const [start, end] = windowRange(tags.length, index, listHeight);
  const countWidth = String(Math.max(0, ...tags.map((t) => t.count))).length;
  const tagWidth = Math.max(8, columns - 4 - countWidth - 2);
  const unused = allTags.filter((t) => !t.count).length;
  return (
    <Split layout={layout} height={contentHeight} preview={selectedTag ? <TagPreview tag={selectedTag.tag} entries={tagged(selectedTag.tag)} height={contentHeight - 2} /> : null}>
      <Box flexDirection="column" height={contentHeight}>
        <Text wrap="truncate-end">
          <Text bold>Tags</Text>
          <Text color={C.muted}>
            {'  '}
            {allTags.length - unused} in use{unused ? ` · ${unused} only in TAGS.md` : ''} · sorted by {sort}
          </Text>
          {text ? <Text color={C.soon}>  filter: “{text}” (esc clears)</Text> : null}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {tags.length === 0 ? <Text color={C.muted}>No tags{text ? ' match' : ' yet'}.</Text> : null}
          {tags.slice(start, end).map((t, i) => {
            const isSel = start + i === index;
            return (
              <Text key={t.tag} wrap="truncate-end">
                <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
                <Text color={t.count ? C.text : C.muted}>{String(t.count).padStart(countWidth)}</Text>{'  '}
                <Text bold={isSel} inverse={isSel} color={t.count || isSel ? undefined : C.muted}>
                  {truncate(t.tag, tagWidth)}
                </Text>
              </Text>
            );
          })}
        </Box>
        {filtering ? (
          <Prompt
            label="Filter tags:"
            initial={text}
            hint="matches tag names · empty clears · esc cancel"
            onSubmit={(v) => {
              setText(v.trim());
              setIndex(0);
              setFiltering(false);
            }}
            onCancel={() => setFiltering(false)}
          />
        ) : null}
      </Box>
    </Split>
  );
}

// Right pane while choosing a tag: the entries that carry it, newest first.
function TagPreview({ tag, entries, height }) {
  if (!entries.length) return <Text color={C.muted}>No entries tagged {tag} yet (it's listed in TAGS.md).</Text>;
  const rows = Math.max(1, height - 2);
  return (
    <>
      <Text wrap="truncate-end">
        <Text bold color={C.accent}>
          {tag}
        </Text>
        <Text color={C.muted}> {entryCount(entries.length)} · enter to browse them</Text>
      </Text>
      <Text> </Text>
      {entries.slice(0, rows).map((e) => (
        <Text key={e.path} wrap="truncate-end">
          <Text color={C.muted}>{(e.date || '----------').padEnd(11)}</Text>
          <Text color={C[TYPE_COLORS[e.type]]}>{e.type.padEnd(6)}</Text>
          {e.title}
        </Text>
      ))}
      {entries.length > rows ? <Text color={C.muted}>… {entries.length - rows} more</Text> : null}
    </>
  );
}
