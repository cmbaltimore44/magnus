import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useCapture } from '../context.js';

export function Prompt({ label, initial = '', placeholder = '', hint, onSubmit, onCancel }) {
  useCapture();
  const [value, setValue] = useState(initial);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1}>
      <Box>
        <Text color={C.accent} bold>
          {label}{' '}
        </Text>
        <TextInput value={value} onChange={setValue} placeholder={placeholder} onSubmit={(v) => onSubmit(v)} />
      </Box>
      <Text color={C.muted}>{hint || 'enter to confirm · esc to cancel'}</Text>
    </Box>
  );
}

export function Confirm({ message, onYes, onNo }) {
  useCapture();
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onYes();
    else if (input === 'n' || input === 'N' || key.escape) onNo();
  });
  return (
    <Box borderStyle="round" borderColor={C.danger} paddingX={1}>
      <Text>
        {message} <Text bold>[y/N]</Text>
      </Text>
    </Box>
  );
}

// Pick one option from a short list.
export function Choice({ title, options, initialIndex = 0, onPick, onCancel }) {
  useCapture();
  const [index, setIndex] = useState(initialIndex);
  useInput((input, key) => {
    if (key.escape) onCancel();
    else if (key.upArrow || input === 'k') setIndex((i) => (i - 1 + options.length) % options.length);
    else if (key.downArrow || input === 'j') setIndex((i) => (i + 1) % options.length);
    else if (key.return) onPick(options[index]);
  });
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1}>
      <Text color={C.accent} bold>
        {title}
      </Text>
      {options.map((opt, i) => (
        <Text key={opt.key ?? opt.label} bold={i === index}>
          {i === index ? '› ' : '  '}
          <Text color={opt.color}>{opt.swatch ?? ''}</Text>
          {opt.swatch ? ' ' : ''}
          {opt.label}
        </Text>
      ))}
      <Text color={C.muted}>↑↓ choose · enter pick · esc cancel</Text>
    </Box>
  );
}
