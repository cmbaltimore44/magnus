import { Box, Text } from 'ink';
import { getCategory, dueStatus, dueLabel, truncate, PRIORITY_COLORS, DUE_COLORS } from '../../lib/display.js';
import { hexToAnsi } from '../../lib/colors.js';

export function taskCardHeight(task, { showNotes = true } = {}) {
  return 1 + (showNotes && task.notes ? 1 : 0) + (task.category_id || task.due_date ? 1 : 0);
}

// One task as 1–3 lines: priority dot + title (+ star), notes, category/due.
export function TaskCard({ task, categories, selected, width, showNotes = true }) {
  const cat = getCategory(categories, task.category_id);
  const due = dueStatus(task);
  const done = task.status === 'done';
  const priority = task.priority || 'medium';
  const inner = Math.max(4, width - 4);

  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      <Text wrap="truncate-end">
        <Text color="cyan">{selected ? '› ' : '  '}</Text>
        <Text color={PRIORITY_COLORS[priority]}>●</Text>{' '}
        <Text bold={selected} inverse={selected} dimColor={done && !selected}>
          {truncate(task.title, inner - (task.is_starred ? 3 : 1))}
        </Text>
        {task.is_starred ? <Text color="yellow"> ★</Text> : null}
      </Text>
      {showNotes && task.notes ? (
        <Text dimColor wrap="truncate-end">
          {'    '}
          {truncate(task.notes, inner - 1)}
        </Text>
      ) : null}
      {cat || task.due_date ? (
        <Text wrap="truncate-end">
          {'    '}
          {cat ? <Text color={hexToAnsi(cat.color)}>■ {cat.name}</Text> : null}
          {cat && task.due_date ? '  ' : ''}
          {task.due_date ? (
            <Text color={DUE_COLORS[due]} dimColor={!due}>
              {dueLabel(task)}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </Box>
  );
}
