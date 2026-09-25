import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as tasksApi from '../../lib/data/tasks.js';
import * as routinesApi from '../../lib/data/routines.js';
import * as completionsApi from '../../lib/data/completions.js';
import * as booksApi from '../../lib/data/books.js';
import * as focusApi from '../../lib/data/focus.js';
import * as logsApi from '../../lib/data/logs.js';
import { todayISO, addDays } from '../../lib/data/completions.js';
import { completedByWeek, focusByWeek, focusByWhat, routineRates, metricSeries, average, sparkline, bookStats } from '../../lib/stats.js';
import { parseEntries, writingStreak } from '../../lib/journal.js';
import { truncate } from '../../lib/display.js';

const HINTS = '↑↓ scroll (narrow windows) · R refresh · esc home';

async function optional(promise) {
  try {
    return { rows: await promise, missing: false };
  } catch (err) {
    if (logsApi.isMissingSchema(err)) return { rows: [], missing: true };
    throw err;
  }
}

function weekLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).padEnd(7);
}

function Bars({ rows, width, unit = '' }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return rows.map((r) => (
    <Text key={r.label}>
      <Text color={C.muted}>{r.label} </Text>
      <Text color={C.accent}>{'█'.repeat(r.n ? Math.max(1, Math.round((r.n / max) * width)) : 0)}</Text>
      <Text color={C.muted}> {r.n ? `${r.n}${unit}` : ''}</Text>
    </Text>
  ));
}

function Panel({ title, children, width }) {
  return (
    <Box flexDirection="column" width={width} marginBottom={1} flexShrink={0}>
      <Text bold color={C.accent}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

export function Insights() {
  const { navigate, capture, columns, contentHeight } = useAppCtx();
  const [offset, setOffset] = useState(0);
  useHints(HINTS);

  const { data, reload } = useLoader(async () => {
    const since = addDays(todayISO(), -60);
    const [tasks, routines, completions, books, focus, logs, jlist] = await Promise.all([
      tasksApi.listTasks(),
      routinesApi.listRoutines(),
      completionsApi.listCompletions(),
      booksApi.listBooks(),
      optional(focusApi.listFocusSessions(new Date(since + 'T00:00:00').toISOString())),
      optional(logsApi.listLogs(since)),
      capture('jlist', ['--tsv']),
    ]);
    return { tasks, routines, completions, books, focus, logs, entries: jlist.ok ? parseEntries(jlist.stdout) : null };
  });

  useViewInput((input, key) => {
    if (key.escape) return navigate('home');
    if (input === 'R') return reload();
    if (key.upArrow || input === 'k') return setOffset((o) => Math.max(0, o - 1));
    if (key.downArrow || input === 'j') return setOffset((o) => Math.min(5, o + 1));
  });

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  const today = todayISO();
  const two = columns >= 110;
  const colWidth = two ? Math.floor((columns - 6) / 2) : columns - 4;
  const barWidth = Math.max(8, colWidth - 20);
  const missing = data.focus.missing || data.logs.missing;

  const done = completedByWeek(data.tasks, today, 8);
  const focus = focusByWeek(data.focus.rows, today, 8);
  const focusWhat = focusByWhat(data.focus.rows, data.tasks, today, 30);
  const whatWidth = Math.min(20, Math.max(6, ...focusWhat.slice(0, 6).map((f) => f.name.length)));
  const rates = routineRates(data.routines, data.completions, today, 30).sort((a, b) => b.rate - a.rate);
  const nameWidth = Math.min(22, Math.max(6, ...rates.map((r) => r.routine.name.length)));
  const series = ['mood', 'energy', 'sleep'].map((m) => ({ m, values: metricSeries(data.logs.rows, m, today, 30).map((d) => d.value) }));
  const workouts = metricSeries(data.logs.rows, 'workout', today, 30).map((d) => d.value);
  const st = bookStats(data.books, today);
  const monthAgo = addDays(today, -29);
  const recentEntries = data.entries ? data.entries.filter((e) => e.date >= monthAgo && e.date <= today) : [];

  const panels = [
    <Panel key="tasks" title="Tasks finished per week" width={colWidth}>
      <Bars rows={done.map((w) => ({ label: weekLabel(w.start), n: w.count }))} width={barWidth} />
      <Text color={C.muted}>counts tasks finished since schema_003 (completed_at)</Text>
    </Panel>,
    <Panel key="routines" title="Routines · last 30 days" width={colWidth}>
      {rates.length ? (
        rates.slice(0, 8).map((r) => (
          <Text key={r.routine.id} wrap="truncate-end">
            <Text>{truncate(r.routine.name, nameWidth).padEnd(nameWidth)} </Text>
            <Text color={r.rate >= 0.7 ? C.success : r.rate >= 0.4 ? C.soon : C.muted}>
              {'█'.repeat(Math.round(r.rate * Math.max(5, colWidth - nameWidth - 8)))}
            </Text>
            <Text color={C.muted}> {Math.round(r.rate * 100)}%</Text>
          </Text>
        ))
      ) : (
        <Text color={C.muted}>No routines yet.</Text>
      )}
    </Panel>,
    <Panel key="focus" title="Focus per week" width={colWidth}>
      <Bars rows={focus.map((w) => ({ label: weekLabel(w.start), n: w.minutes }))} width={barWidth} unit=" min" />
    </Panel>,
    <Panel key="log" title="Log · last 30 days" width={colWidth}>
      {series.map(({ m, values }) => {
        const avg = average(values);
        const [lo, hi] = m === 'sleep' ? [4, 10] : [1, 5];
        return (
          <Text key={m}>
            <Text color={C.muted}>{logsApi.LOG_LABELS[m].padEnd(9)}</Text>
            <Text color={C.accent}>{sparkline(values, { min: lo, max: hi })}</Text>
            <Text color={C.muted}> {avg == null ? '—' : `avg ${avg.toFixed(1)}${m === 'sleep' ? ' h' : '/5'}`}</Text>
          </Text>
        );
      })}
      <Text>
        <Text color={C.muted}>{'Workouts'.padEnd(9)}</Text>
        <Text color={C.accent}>{sparkline(workouts, { min: 0 })}</Text>
        <Text color={C.muted}>
          {' '}
          {workouts.filter(Boolean).length} · {workouts.reduce((n, v) => n + (v || 0), 0)} min
        </Text>
      </Text>
    </Panel>,
    <Panel key="focusWhat" title="Focus by task or label · last 30 days" width={colWidth}>
      {focusWhat.length ? (
        <Bars rows={focusWhat.slice(0, 6).map((f) => ({ label: truncate(f.name, whatWidth).padEnd(whatWidth), n: f.minutes }))} width={Math.max(5, colWidth - whatWidth - 12)} unit=" min" />
      ) : (
        <Text color={C.muted}>No focus time yet (T starts a timer).</Text>
      )}
    </Panel>,
    <Panel key="writing" title="Writing & reading" width={colWidth}>
      {data.entries ? (
        <Text>
          <Text color={C.muted}>{'Streak'.padEnd(14)}</Text>
          {writingStreak(data.entries, today)} days
        </Text>
      ) : null}
      {data.entries ? (
        <Text>
          <Text color={C.muted}>{'Last 30 days'.padEnd(14)}</Text>
          {recentEntries.filter((e) => e.type === 'daily').length} daily · {recentEntries.filter((e) => e.type === 'essay').length} essays ·{' '}
          {recentEntries.filter((e) => e.type === 'note').length} notes
        </Text>
      ) : null}
      <Text>
        <Text color={C.muted}>{`Books in ${today.slice(0, 4)}`.padEnd(14)}</Text>
        {st.finishedThisYear} finished · {st.reading} reading
      </Text>
    </Panel>,
  ];

  const left = two ? panels.filter((_, i) => i % 2 === 0) : panels.slice(offset);
  const right = two ? panels.filter((_, i) => i % 2 === 1) : [];
  return (
    <Box flexDirection="column" height={contentHeight} overflow="hidden">
      <Text bold>
        Insights {missing ? <Text color={C.soon}>· focus and Log data need supabase/schema_003.sql</Text> : null}
      </Text>
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" marginRight={two ? 2 : 0}>
          {left}
        </Box>
        {two ? <Box flexDirection="column">{right}</Box> : null}
      </Box>
    </Box>
  );
}
