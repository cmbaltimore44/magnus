import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { getCategory, dueStatus, dueLabel, truncate, PRIORITY_COLORS, DUE_COLORS } from '../../lib/display.js';
import { categoryColor } from '../../lib/colors.js';

export function taskCardHeight(task, { showNotes = true, compact = false } = {}) {
  if (compact) return 1;
  return 1 + (showNotes && task.notes ? 1 : 0) + (task.category_id || task.due_date ? 1 : 0);
}

// One task as 1–3 lines: priority dot + title (+ star), notes, category/due.
// `compact` puts category/due on the title line instead (always 1 line).
export function TaskCard({ task, categories, selected, width, showNotes = true, compact = false }) {
  const cat = getCategory(categories, task.category_id);
  const due = dueStatus(task);
  const done = task.status === 'done';
  const priority = task.priority || 'medium';
  const inner = Math.max(4, width - 4);

  const meta = (
    <>
      {cat ? <Text color={categoryColor(cat)}>■ {cat.name}</Text> : null}
      {cat && task.due_date ? '  ' : ''}
      {task.due_date ? <Text color={due ? C[DUE_COLORS[due]] : C.muted}>{dueLabel(task)}</Text> : null}
    </>
  );

  if (compact) {
    const metaLen = (cat ? cat.name.length + 2 : 0) + (cat && task.due_date ? 2 : 0) + dueLabel(task).length;
    const titleWidth = Math.max(8, inner - (task.is_starred ? 3 : 1) - (metaLen ? metaLen + 2 : 0));
    return (
      <Box width={width} flexShrink={0}>
        <Text wrap="truncate-end">
          <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
          <Text color={C[PRIORITY_COLORS[priority]]}>●</Text>{' '}
          <Text bold={selected} inverse={selected} color={done && !selected ? C.muted : undefined}>
            {truncate(task.title, titleWidth)}
          </Text>
          {task.is_starred ? <Text color={C.accent}> ★</Text> : null}
          {metaLen ? '  ' : ''}
          {meta}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      <Text wrap="truncate-end">
        <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
        <Text color={C[PRIORITY_COLORS[priority]]}>●</Text>{' '}
        <Text bold={selected} inverse={selected} color={done && !selected ? C.muted : undefined}>
          {truncate(task.title, inner - (task.is_starred ? 3 : 1))}
        </Text>
        {task.is_starred ? <Text color={C.accent}> ★</Text> : null}
      </Text>
      {showNotes && task.notes ? (
        <Text color={C.muted} wrap="truncate-end">
          {'    '}
          {truncate(task.notes, inner - 1)}
        </Text>
      ) : null}
      {cat || task.due_date ? (
        <Text wrap="truncate-end">
          {'    '}
          {cat ? <Text color={categoryColor(cat)}>■ {cat.name}</Text> : null}
          {cat && task.due_date ? '  ' : ''}
          {task.due_date ? (
            <Text color={due ? C[DUE_COLORS[due]] : C.muted}>
              {dueLabel(task)}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </Box>
  );
}
