import { useMemo, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as tasksApi from '../../lib/data/tasks.js';
import * as categoriesApi from '../../lib/data/categories.js';
import * as projectsApi from '../../lib/data/projects.js';
import { todayISO } from '../../lib/data/completions.js';
import { groupUpcoming, UPCOMING_GROUPS, UPCOMING_LABELS } from '../../lib/stats.js';
import { getCategory, PRIORITY_COLORS, PROJECT_STATUS_LABELS, truncate } from '../../lib/display.js';
import { categoryColor } from '../../lib/colors.js';
import { moveIndex, windowRange } from '../components/layout.js';

// Overdue → the next 7 days, across tasks (due date) and projects (target date).
const HINTS = '↑↓ move · space mark done · t focus · enter open · R refresh · esc home';

function dayLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Upcoming() {
  const { navigate, notify, startFocus, columns, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  useHints(HINTS);

  const { data, setData, reload } = useLoader(async () => {
    const [tasks, categories, projects] = await Promise.all([
      tasksApi.listTasks(),
      categoriesApi.listCategories(),
      projectsApi.listProjects(),
    ]);
    return { tasks, categories, projects };
  });

  const today = todayISO();
  const groups = useMemo(() => (data ? groupUpcoming(data.tasks, data.projects, today) : null), [data, today]);
  const lines = useMemo(() => {
    if (!groups) return [];
    return UPCOMING_GROUPS.flatMap((g) => (groups[g].length ? [{ header: g, count: groups[g].length }, ...groups[g].map((entry) => ({ entry }))] : []));
  }, [groups]);
  const entries = lines.filter((l) => l.entry).map((l) => l.entry);
  const selected = entries[Math.min(index, entries.length - 1)];

  const markDone = async (task) => {
    try {
      const updates = { status: 'done', ...(task.is_starred ? { is_starred: false } : {}) };
      const updated = await tasksApi.updateTask(task.id, updates);
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? updated : t)) }));
      notify(`“${task.title}” → Done`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput((input, key) => {
    if (key.escape) return navigate('home');
    if (input === 'R') return reload();
    if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, entries.length));
    if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, entries.length));
    if (!selected) return;
    if (input === ' ' && selected.kind === 'task') return markDone(selected.item);
    if (input === 't' && selected.kind === 'task') return startFocus(selected.item);
    if (key.return) {
      if (selected.kind === 'task') return navigate('board', { taskId: selected.item.id, edit: true });
      return navigate('projects', { projectId: selected.item.id });
    }
  });

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  const width = columns - 4;
  const selectedLine = lines.findIndex((l) => l.entry === selected);
  const [start, end] = windowRange(lines.length, Math.max(0, selectedLine), contentHeight - 2);

  return (
    <Box flexDirection="column" height={contentHeight} overflow="hidden">
      <Text bold>
        Upcoming <Text color={C.muted}>overdue · today · next 7 days</Text>
      </Text>
      {entries.length === 0 ? (
        <Box marginTop={1}>
          <Text color={C.muted}>Nothing due in the next week. Add due dates on the Board or target dates on Projects.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {lines.slice(start, end).map((line) =>
            line.header ? (
              <Text key={line.header} bold color={line.header === 'overdue' ? C.overdue : C.accent}>
                {UPCOMING_LABELS[line.header]} <Text color={C.muted}>{line.count}</Text>
              </Text>
            ) : (
              <UpcomingLine key={line.entry.kind + line.entry.item.id} entry={line.entry} categories={data.categories} selected={line.entry === selected} width={width} />
            )
          )}
        </Box>
      )}
    </Box>
  );
}

function UpcomingLine({ entry, categories, selected, width }) {
  const { kind, item, date } = entry;
  const date10 = dayLabel(date).padEnd(12);
  if (kind === 'project') {
    const title = truncate(item.name, Math.max(10, width - 40));
    return (
      <Text wrap="truncate-end">
        <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
        <Text color={C.muted}>{date10}</Text>
        <Text bold={selected} inverse={selected}>
          {title}
        </Text>
        <Text color={C.muted}>  Project · {PROJECT_STATUS_LABELS[item.status]}</Text>
      </Text>
    );
  }
  const cat = getCategory(categories, item.category_id);
  const title = truncate(item.title, Math.max(10, width - 40));
  return (
    <Text wrap="truncate-end">
      <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
      <Text color={C.muted}>{date10}</Text>
      <Text color={C[PRIORITY_COLORS[item.priority]]}>● </Text>
      <Text bold={selected} inverse={selected}>
        {title}
      </Text>
      {item.is_starred ? <Text color={C.accent}> ★</Text> : null}
      {cat ? <Text color={categoryColor(cat.color)}>  ■ {cat.name}</Text> : null}
      {item.status === 'doing' ? <Text color={C.muted}>  In Progress</Text> : null}
    </Text>
  );
}
