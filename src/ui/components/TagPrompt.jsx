import { useEffect, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppCtx, useCapture } from '../context.js';
import { listedTags, suggestTags, parseEntries } from '../../lib/journal.js';

// The "Tags / links" prompt, with suggestions from TAGS.md and the tags you
// already use (counts from jlist) for the word being typed. tab completes
// the first suggestion. Words inside [[…]] are links, not tags.
export function TagPrompt({ hint, onSubmit, onCancel }) {
  useCapture();
  const { capture } = useAppCtx();
  const [value, setValue] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [listed] = useState(() => listedTags());
  const [counts, setCounts] = useState({});

  useEffect(() => {
    capture('jlist', ['--tsv']).then((res) => {
      if (!res.ok) return;
      const c = {};
      for (const e of parseEntries(res.stdout)) for (const t of e.tags) if (t) c[t] = (c[t] || 0) + 1;
      setCounts(c);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inLink = /\[\[[^\]]*$/.test(value);
  const last = value.split(/\s+/).pop() || '';
  const word = inLink || /\s$/.test(value) || last.startsWith('[[') ? '' : last;
  const typed = new Set(value.split(/\s+/).map((w) => w.replace(/^#/, '').toLowerCase()));
  const current = word.replace(/^#/, '').toLowerCase();
  // (skip tags already typed earlier in the line, but keep the word itself)
  const suggestions = word ? suggestTags(word, listed, counts).filter((t) => t === current || !typed.has(t)) : [];
  const shown = word ? suggestions : suggestTags('', listed, counts, 8).filter((t) => !typed.has(t));

  useInput((_input, key) => {
    if (key.escape) return onCancel();
    if (key.tab && word && suggestions.length) {
      setValue(value.slice(0, value.length - word.length) + suggestions[0] + ' ');
      setInputKey((k) => k + 1); // remount so the cursor lands at the end
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} flexShrink={0}>
      <Box>
        <Text color={C.accent} bold>
          Tags / links:{' '}
        </Text>
        <TextInput key={inputKey} value={value} onChange={setValue} placeholder="idea work [[some-slug]]" onSubmit={onSubmit} />
      </Box>
      <Text wrap="truncate-end">
        <Text color={C.muted}>{word ? 'tab → ' : 'tags: '}</Text>
        {shown.length ? (
          shown.map((t, i) => (
            <Text key={t}>
              {i ? <Text color={C.muted}> · </Text> : null}
              <Text color={i === 0 && word ? C.accent : undefined} bold={i === 0 && !!word}>
                {t}
              </Text>
              {counts[t] ? <Text color={C.muted}> {counts[t]}</Text> : null}
              {!listed.includes(t) ? <Text color={C.soon}>*</Text> : null}
            </Text>
          ))
        ) : (
          <Text color={C.muted}>{word ? 'no match: a new tag (it will be flagged)' : 'none yet'}</Text>
        )}
      </Text>
      <Text color={C.muted} wrap="truncate-end">
        {hint}
      </Text>
    </Box>
  );
}
