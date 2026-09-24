import { useEffect, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppCtx, useCapture } from '../context.js';
import * as tasksApi from '../../lib/data/tasks.js';
import * as categoriesApi from '../../lib/data/categories.js';
import { parseQuickAdd, describeQuickAdd } from '../../lib/quickadd.js';
import { cleanText } from '../../lib/sanitize.js';

const MAX_STARRED = 3;

// The `a` overlay: one line → a task (or `> text` → the journal inbox).
export function QuickAdd({ onClose, initial = '', onCreated }) {
  useCapture();
  const { userId, notify, capture, dataChanged } = useAppCtx();
  const [value, setValue] = useState(initial);
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([categoriesApi.listCategories(), tasksApi.listTasks()])
      .then(([categories, tasks]) => setData({ categories, tasks }))
      .catch((err) => notify(err.message, 'error'));
  }, [notify]);

  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  const parsed = parseQuickAdd(value, data?.categories || []);

  const submit = async () => {
    if (parsed.inbox != null) {
      if (!parsed.inbox) return;
      onClose();
      const res = await capture('capture', [parsed.inbox]);
      const msg = res.ok ? 'Added to the journal inbox' : res.stderr.trim() || 'capture failed';
      return notify(cleanText(msg, { keepNewlines: false }), res.ok ? 'success' : 'error');
    }
    if (!parsed.title || !data) return;
    const { title, ...fields } = parsed;
    let note = '';
    if (fields.is_starred && data.tasks.filter((t) => t.is_starred).length >= MAX_STARRED) {
      fields.is_starred = false;
      note = ` (not starred — already ${MAX_STARRED} starred)`;
    }
    onClose();
    try {
      await tasksApi.createTask(userId, { title, notes: null, status: 'todo', ...fields }, data.tasks.length);
      notify(`Added “${title}”${note}`, 'success');
      dataChanged();
      onCreated?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const preview = describeQuickAdd(parsed, data?.categories || []);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} flexShrink={0}>
      <Box>
        <Text color={C.accent} bold>
          Quick add:{' '}
        </Text>
        <TextInput value={value} onChange={setValue} placeholder="renew passport fri !high #home *" onSubmit={submit} />
      </Box>
      <Text color={C.muted} wrap="truncate-end">
        {preview || 'date (fri, +3, 10/1) · !high/!low · #category · * star · "> text" → journal inbox'}
      </Text>
    </Box>
  );
}
