import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as tasksApi from '../../lib/data/tasks.js';
import * as categoriesApi from '../../lib/data/categories.js';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_COLORS,
  sortForColumn,
  getCategory,
  plural,
} from '../../lib/display.js';
import { categoryColor, CATEGORY_SWATCHES } from '../../lib/colors.js';
import { TaskCard, taskCardHeight } from '../components/TaskCard.jsx';
import { Form } from '../components/Form.jsx';
import { Prompt, Confirm, Choice } from '../components/Prompt.jsx';
import { windowByHeight, windowRange, moveIndex, swapped } from '../components/layout.js';

const HINTS =
  '←→ column · ↑↓ task · space cycle status · s star · enter edit · n new · d delete · f filter · c category filter · C categories · R refresh · esc home';

function matchesFilters(task, filterText, filterCategoryId) {
  if (filterCategoryId && task.category_id !== filterCategoryId) return false;
  if (filterText) {
    const haystack = (task.title + ' ' + (task.notes || '')).toLowerCase();
    if (!haystack.includes(filterText.toLowerCase())) return false;
  }
  return true;
}

function buildColumns(tasks, filterText, filterCategoryId) {
  const visible = tasks.filter((t) => matchesFilters(t, filterText, filterCategoryId));
  return TASK_STATUSES.map((status) => visible.filter((t) => t.status === status).sort(sortForColumn));
}

function locate(columns, taskId) {
  for (let c = 0; c < columns.length; c++) {
    const i = columns[c].findIndex((t) => t.id === taskId);
    if (i >= 0) return { col: c, idx: i };
  }
  return null;
}

function taskFields(categories) {
  return [
    { key: 'title', label: 'Title', type: 'text', required: true },
    {
      key: 'category_id',
      label: 'Category',
      type: 'select',
      options: [
        { value: null, label: '(none)' },
        ...categories.map((c) => ({ value: c.id, label: c.name, color: categoryColor(c) })),
      ],
    },
    { key: 'due_date', label: 'Due', type: 'date' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      default: 'medium',
      options: PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1), color: C[PRIORITY_COLORS[p]] })),
    },
    { key: 'notes', label: 'Notes', type: 'longtext' },
  ];
}

export function Board({ params }) {
  const { userId, navigate, notify, columns: termCols, contentHeight } = useAppCtx();
  const [col, setCol] = useState(0);
  const [rowByCol, setRowByCol] = useState([0, 0, 0]);
  const [filterText, setFilterText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [mode, setMode] = useState(null);
  useHints(mode?.type === 'categories' ? null : HINTS);

  const { data, setData, reload } = useLoader(async () => {
    const [categories, tasks] = await Promise.all([categoriesApi.listCategories(), tasksApi.listTasks()]);
    return { categories, tasks };
  });

  const cols = useMemo(
    () => (data ? buildColumns(data.tasks, filterText, filterCategoryId) : [[], [], []]),
    [data, filterText, filterCategoryId]
  );

  const select = (tasksArr, taskId) => {
    const where = locate(buildColumns(tasksArr, filterText, filterCategoryId), taskId);
    if (!where) return;
    setCol(where.col);
    setRowByCol((r) => r.map((v, i) => (i === where.col ? where.idx : v)));
  };

  // Arriving from search / Today with a specific task: select it, maybe edit.
  const handledParams = useRef(false);
  useEffect(() => {
    if (!data || handledParams.current || !params?.taskId) return;
    handledParams.current = true;
    const task = data.tasks.find((t) => t.id === params.taskId);
    if (!task) return notify('That task no longer exists.', 'error');
    select(data.tasks, task.id);
    if (params.edit) setMode({ type: 'form', task });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = Math.min(rowByCol[col], Math.max(0, cols[col].length - 1));
  const selected = cols[col][row] || null;

  const replaceTask = (updated) =>
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === updated.id ? updated : t)) }));

  const cycleStatus = async (task, delta = 1) => {
    const i = TASK_STATUSES.indexOf(task.status);
    const next = TASK_STATUSES[(i + delta + TASK_STATUSES.length) % TASK_STATUSES.length];
    const updates = { status: next };
    // Same rule as the web board: finishing a task auto-unstars it.
    if (next === 'done' && task.is_starred) updates.is_starred = false;
    const optimistic = data.tasks.map((t) => (t.id === task.id ? { ...t, ...updates } : t));
    setData((d) => ({ ...d, tasks: optimistic }));
    select(optimistic, task.id);
    try {
      replaceTask(await tasksApi.updateTask(task.id, updates));
    } catch (err) {
      replaceTask(task);
      notify(err.message, 'error');
    }
  };

  const toggleStar = async (task) => {
    const next = !task.is_starred;
    if (next && data.tasks.filter((t) => t.is_starred).length >= 3) {
      notify('You can only star up to 3 tasks for Today. Unstar one first.', 'info');
      return;
    }
    replaceTask({ ...task, is_starred: next });
    try {
      await tasksApi.updateTask(task.id, { is_starred: next });
    } catch (err) {
      replaceTask(task);
      notify(err.message, 'error');
    }
  };

  const saveTask = async (fields) => {
    const existing = mode.task;
    if (existing && fields.status === 'done' && existing.is_starred) fields.is_starred = false;
    if (existing) {
      const updated = await tasksApi.updateTask(existing.id, fields);
      const tasks = data.tasks.map((t) => (t.id === updated.id ? updated : t));
      setData((d) => ({ ...d, tasks }));
      select(tasks, updated.id);
    } else {
      const created = await tasksApi.createTask(userId, fields, data.tasks.length);
      const tasks = [...data.tasks, created];
      setData((d) => ({ ...d, tasks }));
      select(tasks, created.id);
    }
    setMode(null);
  };

  const deleteTask = async (task) => {
    setMode(null);
    try {
      await tasksApi.deleteTask(task.id);
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }));
      notify('Task deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const cycleCategoryFilter = () => {
    const ids = ['', ...data.categories.map((c) => c.id)];
    setFilterCategoryId(ids[(ids.indexOf(filterCategoryId) + 1) % ids.length]);
  };

  useViewInput(
    (input, key) => {
      if (!data) return;
      if (key.escape) {
        if (filterText || filterCategoryId) {
          setFilterText('');
          setFilterCategoryId('');
          return;
        }
        return navigate('home');
      }
      if (input === 'R') return reload();
      if (key.leftArrow || input === 'h') return setCol((c) => (c + 2) % 3);
      if (key.rightArrow || input === 'l') return setCol((c) => (c + 1) % 3);
      const setRow = (delta) =>
        setRowByCol((r) => r.map((v, i) => (i === col ? moveIndex(row, delta, cols[col].length) : v)));
      if (key.upArrow || input === 'k') return setRow(-1);
      if (key.downArrow || input === 'j') return setRow(1);
      if (key.pageUp) return setRow(-10);
      if (key.pageDown) return setRow(10);
      if (input === 'n') return setMode({ type: 'form', task: null, status: TASK_STATUSES[col] });
      if (input === 'f') return setMode({ type: 'filter' });
      if (input === 'c') return cycleCategoryFilter();
      if (input === 'C') return setMode({ type: 'categories' });
      if (!selected) return;
      if (input === ' ') return cycleStatus(selected, 1);
      if (input === 'H') return cycleStatus(selected, -1);
      if (input === 'L') return cycleStatus(selected, 1);
      if (input === 's') return toggleStar(selected);
      if (key.return || input === 'e') return setMode({ type: 'form', task: selected });
      if (input === 'd') return setMode({ type: 'confirm', task: selected });
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  if (mode?.type === 'form') {
    return (
      <Form
        title={mode.task ? 'Edit Task' : 'New Task'}
        fields={taskFields(data.categories)}
        initial={mode.task || { status: mode.status, priority: 'medium' }}
        onSubmit={saveTask}
        onCancel={() => setMode(null)}
      />
    );
  }

  if (mode?.type === 'categories') {
    return (
      <CategoryManager
        categories={data.categories}
        tasks={data.tasks}
        userId={userId}
        onChange={(categories, tasks) => setData((d) => ({ ...d, categories, tasks: tasks ?? d.tasks }))}
        onClose={() => setMode(null)}
      />
    );
  }

  const filterCat = getCategory(data.categories, filterCategoryId);
  const filterBits = [
    filterText ? `text “${filterText}”` : null,
    filterCat ? `category ${filterCat.name}` : null,
  ].filter(Boolean);

  const overlayHeight = mode ? 4 : 0;
  const colHeight = contentHeight - 1 - overlayHeight;
  const narrow = termCols < 84;
  const colWidth = narrow ? termCols - 4 : Math.floor((termCols - 4) / 3);

  const renderColumn = (c) => {
    const list = cols[c];
    const active = c === col;
    const cardWidth = colWidth - 4;
    const budget = Math.max(1, colHeight - 3);
    const heights = list.map((t) => taskCardHeight(t));
    const [start, end] = windowByHeight(heights, active ? row : Math.min(rowByCol[c], list.length - 1), budget);
    return (
      <Box
        key={c}
        flexDirection="column"
        width={colWidth}
        height={colHeight}
        borderStyle="round"
        borderColor={active ? C.accent : C.border}
        paddingX={1}
        overflow="hidden"
      >
        <Text bold color={active ? C.accent : undefined}>
          {TASK_STATUS_LABELS[TASK_STATUSES[c]]} <Text color={C.muted}>{list.length}</Text>
          {start > 0 ? <Text color={C.muted}> ↑{start}</Text> : null}
          {end < list.length ? <Text color={C.muted}> ↓{list.length - end}</Text> : null}
        </Text>
        {list.length === 0 ? <Text color={C.muted}>{c === 0 ? 'No tasks yet' : 'Nothing here'}</Text> : null}
        {list.slice(start, end).map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            categories={data.categories}
            selected={active && start + i === row}
            width={cardWidth}
          />
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text wrap="truncate-end">
        <Text bold>Board</Text>
        <Text color={C.muted}> · {plural(data.tasks.length, 'task')}</Text>
        {filterBits.length ? (
          <Text color={C.accent}>
            {'  '}filter: {filterBits.join(', ')} <Text color={C.muted}>(esc clears)</Text>
          </Text>
        ) : null}
        {narrow ? (
          <Text color={C.muted}>
            {'  '}
            {TASK_STATUSES.map((s, i) => (i === col ? `[${TASK_STATUS_LABELS[s]}]` : TASK_STATUS_LABELS[s])).join(' · ')}
          </Text>
        ) : null}
      </Text>
      <Box>{narrow ? renderColumn(col) : [0, 1, 2].map(renderColumn)}</Box>
      {mode?.type === 'filter' ? (
        <Prompt
          label="Filter tasks:"
          initial={filterText}
          hint="matches title and notes · empty clears · esc cancel"
          onSubmit={(v) => {
            setFilterText(v.trim());
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'confirm' ? (
        <Confirm message={`Delete “${mode.task.title}”?`} onYes={() => deleteTask(mode.task)} onNo={() => setMode(null)} />
      ) : null}
    </Box>
  );
}

function CategoryManager({ categories, tasks, userId, onChange, onClose }) {
  const { notify, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // null | {type:'name'} | {type:'color', name} | {type:'confirm', cat}
  useHints('↑↓ move · n new · d delete · K/J reorder · esc back to board');

  const selected = categories[Math.min(index, categories.length - 1)];

  const reorder = async (delta) => {
    const next = swapped(categories, index, delta);
    if (!next) return;
    onChange(next.map((c, i) => ({ ...c, sort_order: i })));
    setIndex(index + delta);
    try {
      await categoriesApi.reorderCategories(next.map((c) => c.id));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const create = async (name, swatch) => {
    setMode(null);
    try {
      const created = await categoriesApi.createCategory(userId, { name, color: swatch.hex }, categories.length);
      onChange([...categories, created]);
      setIndex(categories.length);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (cat) => {
    setMode(null);
    try {
      await categoriesApi.deleteCategory(cat.id);
      onChange(
        categories.filter((c) => c.id !== cat.id),
        tasks.map((t) => (t.category_id === cat.id ? { ...t, category_id: null } : t))
      );
      notify('Category deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput(
    (input, key) => {
      if (key.escape) return onClose();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, categories.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, categories.length));
      if (input === 'n') return setMode({ type: 'name' });
      if (!selected) return;
      if (input === 'K') return reorder(-1);
      if (input === 'J') return reorder(1);
      if (input === 'd') return setMode({ type: 'confirm', cat: selected });
    },
    mode === null
  );

  const [start, end] = windowRange(categories.length, index, Math.max(3, contentHeight - 10));
  const nextSwatch = categories.length % CATEGORY_SWATCHES.length;

  return (
    <Box flexDirection="column" backgroundColor={C.surface} borderStyle="round" borderColor={C.accent} paddingX={1}>
      <Text bold color={C.accent}>
        Categories
      </Text>
      {categories.length === 0 ? <Text color={C.muted}>No categories yet — press n to add one.</Text> : null}
      {categories.slice(start, end).map((c, i) => {
        const isSel = start + i === index;
        const count = tasks.filter((t) => t.category_id === c.id).length;
        return (
          <Text key={c.id}>
            <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
            <Text color={categoryColor(c)}>■</Text> <Text bold={isSel}>{c.name}</Text>
            <Text color={C.muted}> {plural(count, 'task')}</Text>
          </Text>
        );
      })}
      {mode?.type === 'name' ? (
        <Prompt
          label="New category name:"
          onSubmit={(v) => (v.trim() ? setMode({ type: 'color', name: v.trim() }) : setMode(null))}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'color' ? (
        <Choice
          title={`Color for “${mode.name}”`}
          options={CATEGORY_SWATCHES.map((s) => ({ ...s, key: s.hex, swatch: '■', color: s.hex }))}
          initialIndex={nextSwatch}
          onPick={(swatch) => create(mode.name, swatch)}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete category “${mode.cat.name}”? Its tasks become uncategorized.`}
          onYes={() => remove(mode.cat)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}
