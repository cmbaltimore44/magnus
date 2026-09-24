import { useState } from 'react';
import { Box, Text } from 'ink';
import { C } from '../../lib/theme.js';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';
import { QuickAdd } from '../components/QuickAdd.jsx';
import { TagPrompt } from '../components/TagPrompt.jsx';
import { readInbox, findInboxLine, removeInboxLine, restoreInboxLine, tagLinkFlags } from '../../lib/journal.js';
import { truncate } from '../../lib/display.js';

// Walk inbox.md one item at a time and send each somewhere:
//   t → a Life Tracker task (quick add, prefilled)   n → a note (new-note --from-inbox-line)
//   e → an essay (new-essay "title")                 d → delete (u undoes)
//   s / → skip   ← back
// The item leaves the inbox once it has somewhere to live.
const HINTS = 't task · n note · e essay · d delete · u undo · s/→ skip · ← back · R reload · esc back';

export function InboxTriage({ onBack, start }) {
  const { notify, offerUndo, contentHeight, columns } = useAppCtx();
  const [items, setItems] = useState(() => readInbox());
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // {type:'task'} | {type:'title', kind} | {type:'tags', kind, title}
  useHints(mode ? null : HINTS);

  const item = items[Math.min(index, items.length - 1)];
  const reload = () => setItems(readInbox());
  const drop = (it) => {
    setItems((list) => list.filter((x) => x.raw !== it.raw));
    setMode(null);
  };

  const removeLine = (it) => {
    try {
      const at = removeInboxLine(it.raw);
      if (at < 0) notify('That line is no longer in inbox.md', 'error');
      return at;
    } catch (err) {
      notify(err.message, 'error');
      return -1;
    }
  };

  const finish = async (kind, title, tagText) => {
    const it = item;
    const extra = tagLinkFlags(tagText);
    if (kind === 'note') {
      const line = findInboxLine(it.raw);
      if (!line) return notify('That line is no longer in inbox.md', 'error');
      // new-note saves the text into the note, then removes the line itself.
      await start({ run: 'new-note', tab: true }, ['--from-inbox-line', String(line), title, ...extra]);
    } else {
      await start({ run: 'new-essay', tab: true }, [title, ...extra]);
      removeLine(it);
    }
    drop(it);
  };

  useViewInput(
    (input, key) => {
      if (key.escape) return onBack();
      if (input === 'R') return reload();
      if (!item) return;
      if (input === 's' || key.rightArrow) return setIndex((i) => Math.min(items.length - 1, i + 1));
      if (key.leftArrow) return setIndex((i) => Math.max(0, i - 1));
      if (input === 't') return setMode({ type: 'task' });
      if (input === 'n') return setMode({ type: 'title', kind: 'note' });
      if (input === 'e') return setMode({ type: 'title', kind: 'essay' });
      if (input === 'd') {
        const at = removeLine(item);
        if (at >= 0) {
          const { raw } = item;
          drop(item);
          offerUndo('Deleted from the inbox', async () => {
            restoreInboxLine(raw, at);
            setItems(readInbox());
          });
        }
      }
    },
    mode === null
  );

  const width = columns - 4;
  const list = items.slice(index + 1, index + 1 + Math.max(0, contentHeight - 12));
  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text bold>
        Triage Inbox{' '}
        <Text color={C.muted}>{items.length ? `${Math.min(index, items.length - 1) + 1} of ${items.length}` : ''}</Text>
      </Text>
      {!item ? (
        <Box marginTop={1}>
          <Text color={C.success}>Inbox zero. Nothing left to triage.</Text>
        </Box>
      ) : (
        <>
          <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} flexShrink={0}>
            <Text wrap="wrap">{item.text}</Text>
            {item.when ? <Text color={C.muted}>captured {item.when}</Text> : null}
          </Box>
          {mode?.type === 'task' ? (
            <QuickAdd
              initial={item.text}
              onClose={() => setMode(null)}
              onCreated={() => {
                removeLine(item);
                drop(item);
              }}
            />
          ) : null}
          {mode?.type === 'title' ? (
            <Prompt
              key="title"
              label={mode.kind === 'note' ? 'Note title:' : 'Essay title:'}
              initial={truncate(item.text, 60).replace(/…$/, '')}
              hint="enter to continue · esc cancel"
              onSubmit={(v) => (v.trim() ? setMode({ type: 'tags', kind: mode.kind, title: v.trim() }) : setMode(null))}
              onCancel={() => setMode(null)}
            />
          ) : null}
          {mode?.type === 'tags' ? (
            <TagPrompt
              key="tags"
              hint={`optional · [[slug]] adds a link · enter to create the ${mode.kind} (opens in a new tab)`}
              onSubmit={(v) => finish(mode.kind, mode.title, v)}
              onCancel={() => setMode(null)}
            />
          ) : null}
          {list.length ? (
            <Box marginTop={1} flexDirection="column">
              <Text color={C.muted}>Up next</Text>
              {list.map((it) => (
                <Text key={it.line} color={C.muted} wrap="truncate-end">
                  {'  '}
                  {truncate(it.text, width - 2)}
                </Text>
              ))}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
