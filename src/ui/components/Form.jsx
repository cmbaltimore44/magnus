import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppCtx, useCapture } from '../context.js';
import { parseDateInput } from '../../lib/dates.js';

// Generic record editor.
// Field types:
//   text      single-line input
//   longtext  notes — edited inline when single-line, or in $EDITOR (ctrl+e)
//   date      free-form date text, parsed on save (see lib/dates.js)
//   select    options: [{ value, label, color? }], cycled with ←/→
//   toggle    boolean, toggled with space or ←/→

function toEditable(field, value) {
  if (field.type === 'toggle') return Boolean(value);
  if (field.type === 'select') {
    const found = field.options.find((o) => o.value === value);
    return found ? found.value : field.options[0]?.value;
  }
  return value == null ? '' : String(value);
}

function fromEditable(field, value) {
  if (field.type === 'toggle' || field.type === 'select') return value;
  if (field.type === 'date') {
    try {
      return parseDateInput(value);
    } catch (err) {
      throw new Error(`${field.label}: ${err.message}`);
    }
  }
  const trimmed = String(value).trim();
  if (field.required && !trimmed) throw new Error(`${field.label} is required`);
  return trimmed || null;
}

const DATE_HINT = 'YYYY-MM-DD, 10/1, today, tomorrow, +3, fri — blank clears';

export function Form({ title, fields, initial = {}, onSubmit, onCancel }) {
  useCapture();
  const { editText } = useAppCtx();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, toEditable(f, initial[f.key] ?? f.default)]))
  );
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const field = fields[focus];
  const setValue = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const isMultiline = (f) => f.type === 'longtext' && String(values[f.key]).includes('\n');
  const hasInlineInput = (f) => ['text', 'date'].includes(f.type) || (f.type === 'longtext' && !isMultiline(f));

  const submit = async () => {
    if (busy) return;
    let out;
    try {
      out = {};
      for (const f of fields) out[f.key] = fromEditable(f, values[f.key]);
    } catch (err) {
      setError(err.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(out);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  const cycle = (delta) => {
    if (field.type === 'toggle') {
      setValue(field.key, !values[field.key]);
      return;
    }
    const opts = field.options;
    const i = opts.findIndex((o) => o.value === values[field.key]);
    setValue(field.key, opts[(i + delta + opts.length) % opts.length].value);
  };

  useInput(
    (input, key) => {
      if (key.escape) return onCancel();
      if (key.shift && key.tab) return setFocus((i) => (i - 1 + fields.length) % fields.length);
      if (key.upArrow) return setFocus((i) => (i - 1 + fields.length) % fields.length);
      if (key.downArrow || key.tab) return setFocus((i) => (i + 1) % fields.length);

      if (field.type === 'longtext' && key.ctrl && input === 'e') {
        // ink-text-input also sees this keystroke and inserts an "e"; the
        // value captured by this render's closure predates that, so we use it
        // (and overwrite the stray "e") once the editor returns.
        const original = values[field.key];
        editText(original).then((edited) => setValue(field.key, edited ?? original));
        return;
      }

      if (field.type === 'select' || field.type === 'toggle') {
        if (key.leftArrow) cycle(-1);
        else if (key.rightArrow || input === ' ') cycle(1);
      }

      // Inline inputs submit through TextInput's own onSubmit.
      if (key.return && !hasInlineInput(field)) submit();
    },
    { isActive: !busy }
  );

  const labelWidth = Math.max(...fields.map((f) => f.label.length)) + 4;

  const renderValue = (f, focused) => {
    const v = values[f.key];
    if (f.type === 'toggle') return <Text color={focused ? 'cyan' : undefined}>{v ? '[x] yes' : '[ ] no'}</Text>;
    if (f.type === 'select') {
      const opt = f.options.find((o) => o.value === v) || f.options[0];
      return (
        <Text>
          {focused ? <Text color="cyan">‹ </Text> : '  '}
          <Text color={opt?.color}>{opt?.label}</Text>
          {focused ? <Text color="cyan"> ›</Text> : ''}
        </Text>
      );
    }
    if (isMultiline(f)) {
      const lines = String(v).split('\n');
      return (
        <Text>
          {lines[0]}
          <Text dimColor> (+{lines.length - 1} more line{lines.length === 2 ? '' : 's'} · ctrl+e to edit)</Text>
        </Text>
      );
    }
    if (focused) {
      return (
        <TextInput
          value={v}
          onChange={(next) => setValue(f.key, next)}
          onSubmit={submit}
          placeholder={f.placeholder || ''}
        />
      );
    }
    return v ? <Text>{v}</Text> : <Text dimColor>{f.placeholder || '—'}</Text>;
  };

  const hint = field.hint || (field.type === 'date' ? DATE_HINT : null);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>
        {title}
      </Text>
      {fields.map((f, i) => (
        <Box key={f.key}>
          <Box width={labelWidth} flexShrink={0}>
            <Text color={i === focus ? 'cyan' : undefined} bold={i === focus}>
              {i === focus ? '› ' : '  '}
              {f.label}
            </Text>
          </Box>
          <Box flexGrow={1}>{renderValue(f, i === focus)}</Box>
        </Box>
      ))}
      {hint ? <Text dimColor>{hint}</Text> : null}
      {error ? <Text color="red">{error}</Text> : null}
      <Text dimColor>
        {busy
          ? 'Saving…'
          : `↑↓ field · ${field.type === 'select' || field.type === 'toggle' ? '←→ change · ' : ''}${
              field.type === 'longtext' ? 'ctrl+e editor · ' : ''
            }enter save · esc cancel`}
      </Text>
    </Box>
  );
}
