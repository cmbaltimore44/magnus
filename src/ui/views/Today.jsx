import { useMemo, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as tasksApi from '../../lib/data/tasks.js';
import * as categoriesApi from '../../lib/data/categories.js';
import * as routinesApi from '../../lib/data/routines.js';
import * as completionsApi from '../../lib/data/completions.js';
import * as quotesApi from '../../lib/data/quotes.js';
import * as booksApi from '../../lib/data/books.js';
import { TIME_OF_DAY, TIME_OF_DAY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from '../../lib/display.js';
import { TaskCard, taskCardHeight } from '../components/TaskCard.jsx';
import { moveIndex, windowRange } from '../components/layout.js';
import { layoutQuote, QuoteBlock } from '../components/Quote.jsx';

// Like the web app, the featured quote is rolled once and kept across view
// switches for the rest of the session; press r to roll a new one.
let featuredQuote;

const HINTS = '↑↓ move · space check off / cycle status · enter open task · s unstar · t focus · r new quote · R refresh · esc home';

export function Today() {
  const { userId, navigate, notify, startFocus, columns, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [quote, setQuote] = useState(featuredQuote ?? null);
  useHints(HINTS);

  const { data, setData, reload } = useLoader(async () => {
    const [tasks, categories, routines, completions, books] = await Promise.all([
      tasksApi.listTasks(),
      categoriesApi.listCategories(),
      routinesApi.listRoutines(),
      completionsApi.listCompletions(),
      booksApi.listBooks(),
    ]);
    if (featuredQuote === undefined) {
      featuredQuote = await quotesApi.pickRandomQuote();
      setQuote(featuredQuote);
    }
    return { tasks, categories, routines, completions, books };
  });

  const items = useMemo(() => {
    if (!data) return [];
    const starred = data.tasks.filter((t) => t.is_starred).slice(0, 3);
    const routines = TIME_OF_DAY.flatMap((tod) =>
      data.routines.filter((r) => r.time_of_day === tod).sort((a, b) => a.sort_order - b.sort_order)
    );
    return [...starred.map((task) => ({ kind: 'task', task })), ...routines.map((routine) => ({ kind: 'routine', routine }))];
  }, [data]);

  const selected = items[Math.min(index, items.length - 1)];
  const today = completionsApi.todayISO();

  const toggleRoutine = async (routine) => {
    const dates = new Set(data.completions.get(routine.id) || []);
    const wasDone = dates.has(today);
    try {
      if (wasDone) await completionsApi.markIncomplete(routine.id, today);
      else await completionsApi.markComplete(userId, routine.id, today);
      if (wasDone) dates.delete(today);
      else dates.add(today);
      setData((d) => ({ ...d, completions: new Map(d.completions).set(routine.id, dates) }));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const updateTask = async (task, updates) => {
    try {
      const updated = await tasksApi.updateTask(task.id, updates);
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? updated : t)) }));
      return updated;
    } catch (err) {
      notify(err.message, 'error');
      return null;
    }
  };

  const cycleStatus = async (task) => {
    const next = TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];
    const updates = { status: next };
    if (next === 'done' && task.is_starred) updates.is_starred = false; // matches the web board
    const updated = await updateTask(task, updates);
    if (updated) notify(`“${task.title}” → ${TASK_STATUS_LABELS[next]}${updates.is_starred === false ? ' (unstarred)' : ''}`, 'success');
  };

  const rollQuote = async () => {
    try {
      featuredQuote = await quotesApi.pickRandomQuote();
      setQuote(featuredQuote);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput((input, key) => {
    if (key.escape) return navigate('home');
    if (input === 'R') return reload();
    if (input === 'r') return rollQuote();
    if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, items.length));
    if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, items.length));
    if (!selected) return;
    if (selected.kind === 'routine' && (input === ' ' || key.return)) return toggleRoutine(selected.routine);
    if (selected.kind === 'task') {
      if (input === ' ') return cycleStatus(selected.task);
      if (key.return) return navigate('board', { taskId: selected.task.id, edit: true });
      if (input === 's') return updateTask(selected.task, { is_starred: false });
      if (input === 't') return startFocus(selected.task);
    }
  });

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  const wide = columns >= 100;
  const leftWidth = wide ? Math.floor((columns - 4) * 0.58) : columns - 4;
  const quoteWidth = wide ? columns - 6 - leftWidth : columns - 4;
  const starred = items.filter((i) => i.kind === 'task');
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const attribution = quote ? quotesApi.formatAttribution(quote, data.books) : '';

  // Row budget, so nothing overflows the screen: date line, the quote box
  // (above everything in the narrow layout), the starred block, then
  // routines, which scroll around the selection.
  // The quote is shown in full, wrapped to the box's inner width (border +
  // padding = 4 columns); only a quote taller than the screen is clipped.
  // Narrow layout stacks quote, starred and routines. If the full quote
  // doesn't fit, starred tasks go compact (one line each) to make room;
  // routines scroll in whatever is left (at least 3 rows).
  const layout = quote ? layoutQuote(quote, attribution, quoteWidth - 4, { indent: 0, attrIndent: 0 }) : null;
  const starredRows = (compact) =>
    1 + (starred.length ? starred.reduce((n, i) => n + taskCardHeight(i.task, { showNotes: false, compact }), 0) : 1);
  // date+margin (2), quote border (2) + margin (1), routines margin+header (2), 3 routine rows
  const roomForQuote = (compact) => contentHeight - 2 - 3 - starredRows(compact) - 2 - 3;
  const compact = !wide && layout != null && layout.height > roomForQuote(false);
  const starredHeight = starredRows(compact);
  const maxQuoteLines = Math.max(2, wide ? contentHeight - 4 : roomForQuote(compact));
  if (layout && layout.height > maxQuoteLines) {
    const keep = maxQuoteLines - 1;
    layout.attrLines = [`… ${layout.height - keep} more lines — see Library (5)`];
    layout.quoteLines = layout.quoteLines.slice(0, keep);
    layout.height = maxQuoteLines;
  }
  const quoteHeight = (layout ? layout.height : 1) + 2;
  const routineBudget = Math.max(3, contentHeight - 2 - (wide ? 0 : quoteHeight + 1) - starredHeight - 2);

  const routineLines = TIME_OF_DAY.flatMap((tod) => {
    const group = items.filter((i) => i.kind === 'routine' && i.routine.time_of_day === tod);
    return group.length ? [{ header: tod }, ...group.map((item) => ({ item }))] : [];
  });
  const selectedLine = Math.max(0, routineLines.findIndex((l) => l.item === selected));
  const [rStart, rEnd] = windowRange(routineLines.length, selectedLine, routineBudget);

  const quoteBox = (
    <Box
      flexDirection="column"
      flexShrink={0}
      borderStyle="round"
      borderColor={C.accent}
      paddingX={1}
      width={quoteWidth}
      marginBottom={wide ? 0 : 1}
      alignSelf="flex-start"
    >
      {layout ? (
        <QuoteBlock layout={layout} />
      ) : (
        <Text color={C.muted}>Add a book highlight or quote to your Library to feature one here.</Text>
      )}
    </Box>
  );

  const left = (
    <Box flexDirection="column" width={leftWidth} marginRight={wide ? 2 : 0} flexShrink={0}>
      <Text bold color={C.accent}>
        ★ Starred
      </Text>
      {starred.length === 0 ? (
        <Text color={C.muted}>  Star up to 3 tasks on the Board (s) to feature them here.</Text>
      ) : (
        starred.map((item) => (
          <TaskCard
            key={item.task.id}
            task={item.task}
            categories={data.categories}
            selected={selected === item}
            width={leftWidth}
            showNotes={false}
            compact={compact}
          />
        ))
      )}
      <Box marginTop={1} flexDirection="column" flexShrink={0}>
        <Text bold color={C.accent}>
          ✓ Routines{' '}
          {rStart > 0 ? <Text color={C.muted}>↑{rStart} </Text> : null}
          {rEnd < routineLines.length ? <Text color={C.muted}>↓{routineLines.length - rEnd}</Text> : null}
        </Text>
        {data.routines.length === 0 ? <Text color={C.muted}>  No routines yet — add some in Routines (3).</Text> : null}
        {routineLines.slice(rStart, rEnd).map((line) =>
          line.header ? (
            <Text key={line.header} color={C.muted} bold>
              {'  '}
              {TIME_OF_DAY_LABELS[line.header]}
            </Text>
          ) : (
            <RoutineLine
              key={line.item.routine.id}
              routine={line.item.routine}
              dates={data.completions.get(line.item.routine.id)}
              today={today}
              selected={selected === line.item}
            />
          )
        )}
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" height={contentHeight} overflow="hidden">
      <Text bold>{dateLabel}</Text>
      <Box marginTop={1} flexDirection={wide ? 'row' : 'column'}>
        {wide ? left : quoteBox}
        {wide ? quoteBox : left}
      </Box>
    </Box>
  );
}

export function RoutineLine({ routine, dates, today, selected, extra }) {
  const set = dates || new Set();
  const done = set.has(today);
  const streak = completionsApi.computeStreak(set, today);
  return (
    <Text wrap="truncate-end">
      <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
      <Text color={done ? C.success : undefined}>{done ? '[✓]' : '[ ]'}</Text>{' '}
      <Text bold={selected} inverse={selected} color={done && !selected ? C.muted : undefined}>
        {routine.name}
      </Text>
      {streak > 0 ? <Text color={C.accent}> 🔥 {streak}</Text> : null}
      {extra}
    </Text>
  );
}
