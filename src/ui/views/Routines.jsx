import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as routinesApi from '../../lib/data/routines.js';
import * as completionsApi from '../../lib/data/completions.js';
import { TIME_OF_DAY, TIME_OF_DAY_LABELS, plural } from '../../lib/display.js';
import { Prompt, Confirm } from '../components/Prompt.jsx';
import { windowRange, moveIndex } from '../components/layout.js';
import { RoutineLine } from './Today.jsx';

const HINTS =
  '↑↓ move · space check off today · K/J reorder · H/L move to earlier/later group · n new · d delete · R refresh · esc home';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HEATMAP_ROWS = 10; // title + months + 7 days + summary

function sortedGroup(routines, tod) {
  return routines.filter((r) => r.time_of_day === tod).sort((a, b) => a.sort_order - b.sort_order);
}

// Same bucketing as the web heatmap (levelForPct) and the same caveat: the
// denominator is today's routine count, since history isn't recorded.
function levelForPct(pct) {
  if (pct <= 0) return 0;
  if (pct <= 25) return 1;
  if (pct <= 50) return 2;
  if (pct <= 75) return 3;
  return 4;
}

// Heatmap levels in terminal colors: empty days are a gray dot, then amber
// → terracotta as more of the day's routines were done (web: accent ramp).
const LEVELS = [
  { color: C.muted, char: '·' },
  { color: C.soon, char: '■' },
  { color: C.soon, char: '■', bold: true },
  { color: C.accent, char: '■' },
  { color: C.accent, char: '■', bold: true },
];

function Heatmap({ routines, completions, columns }) {
  const weeks = Math.max(4, Math.min(53, Math.floor((columns - 10) / 2)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gridEnd = new Date(today);
  gridEnd.setDate(gridEnd.getDate() + (6 - today.getDay()));
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridStart.getDate() - (weeks * 7 - 1));

  const total = routines.length;
  const counts = completionsApi.countsByDate(completions);
  const grid = Array.from({ length: 7 }, () => []);
  const monthChars = Array(weeks * 2).fill(' ');
  let lastMonth = -1;
  let activeDays = 0;
  const cursor = new Date(gridStart);

  for (let w = 0; w < weeks; w++) {
    if (cursor.getMonth() !== lastMonth) {
      lastMonth = cursor.getMonth();
      const label = MONTH_NAMES[lastMonth];
      if (w * 2 + label.length <= monthChars.length) [...label].forEach((ch, k) => (monthChars[w * 2 + k] = ch));
    }
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        grid[d].push(-1);
      } else {
        const count = Math.min(counts.get(completionsApi.toISO(cursor)) || 0, total);
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        grid[d].push(levelForPct(pct));
        if (count > 0) activeDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const dayLabels = ['   ', 'Mon', '   ', 'Wed', '   ', 'Fri', '   '];

  return (
    <Box flexDirection="column">
      <Text bold color={C.accent}>
        Activity
      </Text>
      <Text color={C.muted}>
        {'    '}
        {monthChars.join('')}
      </Text>
      {grid.map((cells, d) => {
        // Merge runs of equal levels into one <Text> to keep the tree small.
        const runs = [];
        for (const level of cells) {
          const last = runs[runs.length - 1];
          if (last && last.level === level) last.n++;
          else runs.push({ level, n: 1 });
        }
        return (
          <Text key={d}>
            <Text color={C.muted}>{dayLabels[d]} </Text>
            {runs.map((run, i) => {
              if (run.level < 0) return <Text key={i}>{'  '.repeat(run.n)}</Text>;
              return (
                <Text key={i} color={LEVELS[run.level].color} bold={LEVELS[run.level].bold}>
                  {`${LEVELS[run.level].char} `.repeat(run.n)}
                </Text>
              );
            })}
          </Text>
        );
      })}
      <Text color={C.muted}>
        {total ? `${plural(activeDays, 'active day')} in the last ${weeks} weeks` : ''}
      </Text>
    </Box>
  );
}

export function Routines({ params }) {
  const { userId, navigate, notify, columns, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null);
  useHints(HINTS);

  const { data, setData, reload } = useLoader(async () => {
    const [routines, completions] = await Promise.all([routinesApi.listRoutines(), completionsApi.listCompletions()]);
    return { routines, completions };
  });

  // Flattened, selectable rows. An empty group gets a placeholder row so you
  // can still land on it and press n to add.
  const rows = useMemo(() => {
    if (!data) return [];
    return TIME_OF_DAY.flatMap((tod) => {
      const group = sortedGroup(data.routines, tod);
      return group.length ? group.map((routine) => ({ tod, routine })) : [{ tod, routine: null }];
    });
  }, [data]);

  const selectRoutine = (id, list = rows) => {
    const i = list.findIndex((r) => r.routine?.id === id);
    if (i >= 0) setIndex(i);
  };

  const handledParams = useRef(false);
  useEffect(() => {
    if (!data || handledParams.current || !params?.routineId) return;
    handledParams.current = true;
    selectRoutine(params.routineId);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = rows[Math.min(index, rows.length - 1)];
  const today = completionsApi.todayISO();

  const toggle = async (routine) => {
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

  // Apply new orderings for one or two groups locally, then persist with the
  // same reorderGroup() call the web app's drag-and-drop uses.
  const applyOrder = async (groups, focusId) => {
    const patch = new Map();
    for (const [tod, ids] of Object.entries(groups)) ids.forEach((id, i) => patch.set(id, { time_of_day: tod, sort_order: i }));
    const routines = data.routines.map((r) => (patch.has(r.id) ? { ...r, ...patch.get(r.id) } : r));
    setData((d) => ({ ...d, routines }));
    const nextRows = TIME_OF_DAY.flatMap((tod) => {
      const g = sortedGroup(routines, tod);
      return g.length ? g.map((routine) => ({ tod, routine })) : [{ tod, routine: null }];
    });
    selectRoutine(focusId, nextRows);
    try {
      await Promise.all(Object.entries(groups).map(([tod, ids]) => routinesApi.reorderGroup(ids, tod)));
    } catch (err) {
      notify(err.message, 'error');
      reload();
    }
  };

  const moveWithinGroup = (routine, delta) => {
    const ids = sortedGroup(data.routines, routine.time_of_day).map((r) => r.id);
    const i = ids.indexOf(routine.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    applyOrder({ [routine.time_of_day]: ids }, routine.id);
  };

  const moveToGroup = (routine, delta) => {
    const from = routine.time_of_day;
    const to = TIME_OF_DAY[TIME_OF_DAY.indexOf(from) + delta];
    if (!to) return;
    const fromIds = sortedGroup(data.routines, from).map((r) => r.id).filter((id) => id !== routine.id);
    const toIds = [...sortedGroup(data.routines, to).map((r) => r.id), routine.id];
    applyOrder({ [from]: fromIds, [to]: toIds }, routine.id);
  };

  const create = async (tod, name) => {
    setMode(null);
    if (!name.trim()) return;
    try {
      const created = await routinesApi.createRoutine(
        userId,
        { name: name.trim(), time_of_day: tod },
        sortedGroup(data.routines, tod).length
      );
      const routines = [...data.routines, created];
      setData((d) => ({ ...d, routines }));
      const nextRows = TIME_OF_DAY.flatMap((t) => {
        const g = sortedGroup(routines, t);
        return g.length ? g.map((routine) => ({ tod: t, routine })) : [{ tod: t, routine: null }];
      });
      selectRoutine(created.id, nextRows);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (routine) => {
    setMode(null);
    try {
      await routinesApi.deleteRoutine(routine.id);
      setData((d) => {
        const completions = new Map(d.completions);
        completions.delete(routine.id);
        return { routines: d.routines.filter((r) => r.id !== routine.id), completions };
      });
      notify('Routine deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput(
    (input, key) => {
      if (!data) return;
      if (key.escape) return navigate('home');
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, rows.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, rows.length));
      if (input === 'n') return setMode({ type: 'new', tod: current?.tod || 'morning' });
      const routine = current?.routine;
      if (!routine) return;
      if (input === ' ' || key.return) return toggle(routine);
      if (input === 'K') return moveWithinGroup(routine, -1);
      if (input === 'J') return moveWithinGroup(routine, 1);
      if (input === 'H') return moveToGroup(routine, -1);
      if (input === 'L') return moveToGroup(routine, 1);
      if (input === 'd') return setMode({ type: 'confirm', routine });
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  const overlay = mode ? 4 : 0;
  const showHeatmap = contentHeight - overlay >= 22 && data.routines.length > 0;
  // Lines for rows + one header per group + page title/spacing.
  const listBudget = contentHeight - overlay - 2 - (showHeatmap ? HEATMAP_ROWS + 1 : 0) - TIME_OF_DAY.length;
  const [start, end] = windowRange(rows.length, index, Math.max(3, listBudget));
  const doneToday = data.routines.filter((r) => data.completions.get(r.id)?.has(today)).length;

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text>
        <Text bold>Routines</Text>
        <Text color={C.muted}>
          {' '}
          · {plural(data.routines.length, 'routine')} · {doneToday}/{data.routines.length} done today
        </Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {TIME_OF_DAY.map((tod) => {
          const visible = rows.map((r, i) => ({ ...r, i })).filter((r) => r.tod === tod && r.i >= start && r.i < end);
          if (visible.length === 0) return null;
          return (
            <Box key={tod} flexDirection="column">
              <Text bold color={C.accent}>
                {TIME_OF_DAY_LABELS[tod]}
              </Text>
              {visible.map((r) =>
                r.routine ? (
                  <RoutineLine
                    key={r.routine.id}
                    routine={r.routine}
                    dates={data.completions.get(r.routine.id)}
                    today={today}
                    selected={r.i === index}
                  />
                ) : (
                  <Text key={`empty-${tod}`} color={C.muted}>
                    <Text color={C.accent}>{r.i === index ? '› ' : '  '}</Text>
                    (empty — press n to add a {TIME_OF_DAY_LABELS[tod].toLowerCase()} routine)
                  </Text>
                )
              )}
            </Box>
          );
        })}
      </Box>
      {mode?.type === 'new' ? (
        <Prompt
          label={`New ${TIME_OF_DAY_LABELS[mode.tod].toLowerCase()} routine:`}
          onSubmit={(v) => create(mode.tod, v)}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete routine “${mode.routine.name}” and its history?`}
          onYes={() => remove(mode.routine)}
          onNo={() => setMode(null)}
        />
      ) : null}
      {showHeatmap ? (
        <Box marginTop={1}>
          <Heatmap routines={data.routines} completions={data.completions} columns={columns} />
        </Box>
      ) : null}
    </Box>
  );
}
