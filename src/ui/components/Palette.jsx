import { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { C } from '../../lib/theme.js';
import { useCapture } from '../context.js';
import { windowRange } from './layout.js';
import { truncate } from '../../lib/display.js';
import { fuzzyScore } from '../../lib/fuzzy.js';

// ctrl+p: every action by name. actions: [{ id, label, group, run }]
// Also the focus timer's picker (placeholder/empty change the wording).
// typed(query) → an extra row for the text itself (e.g. "Focus on “job apps”"):
// first when nothing contains what's typed, last otherwise, so enter still
// picks a real match.
export function Palette({ actions, onClose, height, width, placeholder = 'type an action…', empty = 'No matching action.', typed }) {
  useCapture();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return actions;
    const found = actions
      .map((a) => ({ a, s: fuzzyScore(query, `${a.group} ${a.label}`) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a);
    const extra = typed?.(query);
    if (!extra) return found;
    const q = query.trim().toLowerCase();
    return found.some((a) => a.label.toLowerCase().includes(q)) ? [...found, extra] : [extra, ...found];
  }, [actions, query, typed]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  useInput((_input, key) => {
    if (key.escape) return onClose();
    if (key.upArrow) return setActive((i) => Math.max(0, Math.min(i, results.length - 1) - 1));
    if (key.downArrow) return setActive((i) => Math.min(results.length - 1, i + 1));
  });

  const run = () => {
    const pick = results[current];
    if (!pick) return;
    onClose();
    pick.run();
  };

  const listHeight = Math.max(3, height - 4);
  const [start, end] = windowRange(results.length, current, listHeight);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} height={height} flexShrink={0}>
      <Box>
        <Text color={C.accent} bold>
          {'> '}
        </Text>
        <TextInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActive(0);
          }}
          placeholder={placeholder}
          onSubmit={run}
        />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {results.length === 0 ? <Text color={C.muted}>{empty}</Text> : null}
        {results.slice(start, end).map((a, i) => {
          const sel = start + i === current;
          return (
            <Text key={a.id} wrap="truncate-end">
              <Text color={C.accent}>{sel ? '› ' : '  '}</Text>
              <Text color={C.muted}>{a.group.padEnd(10)}</Text>
              <Text bold={sel} inverse={sel}>
                {truncate(a.label, width - 20)}
              </Text>
              {a.hint ? <Text color={C.muted}>  {a.hint}</Text> : null}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
