import { useState } from 'react';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';

// Front door to the journal scripts already on $PATH. Magnus doesn't
// reimplement any of their logic — it just launches them, handing over the
// terminal for the interactive ones.
//
// Note on New Book/Film Essay: `new-essay` does NOT prompt for a missing
// --book/--film value (a bare `--book` hits `$2: unbound variable` under
// `set -u`, and `--film ""` silently makes a plain essay). So Magnus asks for
// just that title and passes it along; the script's own prompts still handle
// the essay title, author and director.
const ITEMS = [
  { key: 't', label: "Today's Entry", desc: 'today', action: { run: 'today' } },
  { key: 'e', label: 'New Essay', desc: 'new-essay', action: { run: 'new-essay' } },
  { key: 'b', label: 'New Book Essay', desc: 'new-essay --book', action: { prompt: 'Book title:', run: 'new-essay', flag: '--book' } },
  { key: 'f', label: 'New Film Essay', desc: 'new-essay --film', action: { prompt: 'Film title:', run: 'new-essay', flag: '--film' } },
  { key: 's', label: 'Search', desc: 'jsearch <text> · #tag → jsearch -t <tag>', action: { search: true } },
  { key: 'g', label: 'Tags', desc: 'jtags', action: { output: 'jtags' } },
  { key: 'k', label: 'Backlinks', desc: 'jbacklinks <slug>', action: { prompt: 'Slug:', run: 'jbacklinks', placeholder: 'note-slug' } },
  { key: 'v', label: 'Graph', desc: 'jgraph (opens in browser)', action: { quick: 'jgraph' } },
  { key: 'c', label: 'Quick Capture', desc: 'capture "…" → inbox.md', action: { capture: true } },
];

const HINTS = 'press a letter or ↑↓ enter · esc home';

export function Journal() {
  const { navigate, notify, run, capture, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // {type:'prompt', item} | {type:'output', title, lines, offset}
  useHints(mode?.type === 'output' ? '↑↓ scroll · esc back' : HINTS);

  const launch = async (item, value) => {
    const a = item.action;
    if (a.run && !a.prompt) return run(a.run, []);
    if (a.run && a.prompt) {
      if (!value.trim()) return;
      return run(a.run, a.flag ? [a.flag, value.trim()] : [value.trim()]);
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
      return notify(res.ok ? res.stdout.trim() || 'Captured.' : res.stderr.trim() || 'capture failed', res.ok ? 'success' : 'error');
    }
    if (a.output) {
      const res = await capture(a.output, []);
      const text = (res.stdout + (res.stderr ? `\n${res.stderr}` : '')).replace(/\s+$/, '');
      return setMode({ type: 'output', title: item.label, lines: text ? text.split('\n') : ['(no output)'], offset: 0 });
    }
    if (a.quick) {
      notify(`Running ${a.quick}…`, 'info');
      const res = await capture(a.quick, []);
      return notify((res.ok ? res.stdout : res.stderr || res.stdout).trim() || `${a.quick} done`, res.ok ? 'success' : 'error');
    }
  };

  const choose = (item) => {
    if (item.action.prompt || item.action.search || item.action.capture) setMode({ type: 'prompt', item });
    else launch(item, '');
  };

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

  if (mode?.type === 'output') {
    const size = contentHeight - 3;
    const from = Math.min(mode.offset, Math.max(0, mode.lines.length - size));
    return (
      <Box flexDirection="column" height={contentHeight}>
        <Text bold color="cyan">
          {mode.title} <Text dimColor>{mode.lines.length} lines</Text>
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
    ? promptItem.action.search
      ? { label: 'Search journal:', hint: 'text for full-text search · #tag for a tag search · esc cancel' }
      : promptItem.action.capture
        ? { label: 'Capture:', hint: 'appends a timestamped line to inbox.md · esc cancel' }
        : { label: promptItem.action.prompt, placeholder: promptItem.action.placeholder }
    : null;

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text bold>Journal</Text>
      <Box flexDirection="column" marginTop={1}>
        {ITEMS.map((item, i) => (
          <Text key={item.key}>
            <Text color="cyan">{i === index ? '› ' : '  '}</Text>
            <Text color="magenta" bold>
              [{item.key}]
            </Text>{' '}
            <Text bold={i === index}>{item.label.padEnd(16)}</Text>
            <Text dimColor>{item.desc}</Text>
          </Text>
        ))}
      </Box>
      {promptItem ? (
        <Box marginTop={1}>
          <Prompt
            {...promptProps}
            onSubmit={(v) => {
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
