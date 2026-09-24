import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';
import * as logsApi from '../../lib/data/logs.js';
import { todayISO, addDays } from '../../lib/data/completions.js';
import { deleteWithUndo } from '../../lib/undo.js';
import { getPref } from '../../lib/prefs.js';
import { moveIndex } from '../components/layout.js';

// The daily Log (log_entries): mood/energy 1-5, hours slept and weight once a
// day, any number of workouts. ←→ picks the day; the table below shows the
// last two weeks.
const HINTS = '←→ day · ↑↓ row · enter set · d clear / delete · n add workout · t today · R refresh · esc home';
const ROWS = ['mood', 'energy', 'sleep', 'weight', 'workout'];

function fmtNum(v) {
  return v == null ? '' : String(Number(v)).replace(/(\.\d)\d+$/, '$1');
}

function dayTitle(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function Log() {
  const { userId, navigate, notify, offerUndo, contentHeight } = useAppCtx();
  const [date, setDate] = useState(todayISO());
  const [row, setRow] = useState(0);
  const [mode, setMode] = useState(null); // {type:'set', metric} | {type:'workout'}
  useHints(mode ? null : HINTS);
  const unit = getPref('weightUnit', 'lb');

  const { data, reload } = useLoader(async () => {
    try {
      return { entries: await logsApi.listLogs(addDays(todayISO(), -60)), missing: false };
    } catch (err) {
      if (logsApi.isMissingSchema(err)) return { entries: [], missing: true };
      throw err;
    }
  });

  const entries = data?.entries || [];
  const forDay = (d) => entries.filter((e) => e.entry_date === d);
  const day = forDay(date);
  const value = (metric) => day.find((e) => e.metric === metric);
  const workouts = day.filter((e) => e.metric === 'workout');
  const metric = ROWS[row];

  const refresh = reload;

  const setMetric = async (m, text) => {
    setMode(null);
    if (!String(text).trim()) return;
    try {
      await logsApi.setDailyMetric(userId, date, m, String(text).trim());
      await refresh();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const addWorkout = async (text) => {
    setMode(null);
    const m = /^\s*(\d+(?:\.\d+)?)\s*(?:min|m)?\s*(.*)$/.exec(text || '');
    if (!m) return text.trim() ? notify('Workout: minutes first, e.g. "30 run"', 'error') : undefined;
    try {
      await logsApi.addWorkout(userId, date, m[1], m[2].trim() || null);
      await refresh();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const clear = async () => {
    const target = metric === 'workout' ? workouts[workouts.length - 1] : value(metric);
    if (!target) return;
    try {
      const restore = await deleteWithUndo('log_entries', target.id);
      await refresh();
      offerUndo(`Cleared ${logsApi.LOG_LABELS[metric].toLowerCase()}`, restore);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput(
    (input, key) => {
      if (key.escape) return navigate('home');
      if (input === 'R') return refresh();
      if (data?.missing) return;
      if (key.leftArrow || input === 'h') return setDate((d) => addDays(d, -1));
      if (key.rightArrow || input === 'l') return setDate((d) => (d < todayISO() ? addDays(d, 1) : d));
      if (input === 't') return setDate(todayISO());
      if (key.upArrow || input === 'k') return setRow((r) => moveIndex(r, -1, ROWS.length));
      if (key.downArrow || input === 'j') return setRow((r) => moveIndex(r, 1, ROWS.length));
      if (input === 'n') return setMode({ type: 'workout' });
      if (key.return) return setMode(metric === 'workout' ? { type: 'workout' } : { type: 'set', metric });
      if (input === 'd') return clear();
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;
  if (data.missing) {
    return (
      <Box flexDirection="column">
        <Text bold>Log</Text>
        <Text color={C.soon}>The Log needs the log_entries table: run supabase/schema_003.sql in the Supabase SQL editor.</Text>
      </Box>
    );
  }

  const show = (m) => {
    if (m === 'workout') {
      return workouts.length ? workouts.map((w) => `${fmtNum(w.value)} min${w.note ? ` ${w.note}` : ''}`).join(' · ') : '';
    }
    const e = value(m);
    if (!e) return '';
    if (m === 'mood' || m === 'energy') return `${'●'.repeat(Number(e.value))}${'○'.repeat(5 - Number(e.value))}  ${fmtNum(e.value)}/5`;
    if (m === 'sleep') return `${fmtNum(e.value)} h`;
    return `${fmtNum(e.value)} ${unit}`;
  };

  // History: last 14 days (or fewer on short windows), newest first.
  const histRows = Math.max(0, Math.min(14, contentHeight - 12));
  const history = Array.from({ length: histRows }, (_, i) => addDays(todayISO(), -i));
  const cell = (d, m) => {
    const es = forDay(d).filter((e) => e.metric === m);
    if (!es.length) return '·';
    if (m === 'workout') return `${es.reduce((n, e) => n + Number(e.value), 0)}m`;
    return fmtNum(es[0].value);
  };
  const W = 8;

  return (
    <Box flexDirection="column" height={contentHeight} overflow="hidden">
      <Text bold>
        Log <Text color={C.muted}>· </Text>
        <Text color={C.accent}>{dayTitle(date)}</Text>
        {date === todayISO() ? <Text color={C.muted}> (today)</Text> : null}
      </Text>
      <Box flexDirection="column" marginTop={1} flexShrink={0}>
        {ROWS.map((m, i) => (
          <Text key={m} wrap="truncate-end">
            <Text color={C.accent}>{i === row ? '› ' : '  '}</Text>
            <Text bold={i === row} inverse={i === row}>
              {(m === 'weight' ? `Weight (${unit})` : logsApi.LOG_LABELS[m]).padEnd(13)}
            </Text>{' '}
            {show(m) ? <Text>{show(m)}</Text> : <Text color={C.muted}>—</Text>}
          </Text>
        ))}
      </Box>
      {mode?.type === 'set' ? (
        <Prompt
          label={`${logsApi.LOG_LABELS[mode.metric]}:`}
          initial={fmtNum(value(mode.metric)?.value)}
          hint={mode.metric === 'sleep' ? 'hours slept, e.g. 7.5' : mode.metric === 'weight' ? `weight in ${unit}` : '1 (low) – 5 (high)'}
          onSubmit={(v) => setMetric(mode.metric, v)}
          onCancel={() => setMode(null)}
        />
      ) : null}
      {mode?.type === 'workout' ? (
        <Prompt label="Workout:" placeholder="30 run" hint="minutes, then the type (optional) · esc cancel" onSubmit={addWorkout} onCancel={() => setMode(null)} />
      ) : null}
      {histRows > 0 && !mode ? (
        <Box flexDirection="column" marginTop={1} flexShrink={0}>
          <Text color={C.muted}>
            {'Last 2 weeks'.padEnd(14)}
            {['Mood', 'Energy', 'Sleep', 'Weight', 'Workout'].map((h) => h.padEnd(W)).join('')}
          </Text>
          {history.map((d) => (
            <Text key={d} color={d === date ? C.accent : undefined} wrap="truncate-end">
              {new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).padEnd(14)}
              {ROWS.map((m) => cell(d, m).padEnd(W)).join('')}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
