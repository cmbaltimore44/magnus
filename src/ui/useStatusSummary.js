import { useEffect, useState } from 'react';
import * as tasksApi from '../lib/data/tasks.js';
import * as routinesApi from '../lib/data/routines.js';
import * as completionsApi from '../lib/data/completions.js';
import { runCapture } from '../lib/shell.js';
import { parseEntries, writingStreak } from '../lib/journal.js';
import { dueStatus } from '../lib/display.js';

// Numbers for the status bar: overdue / due today, routines done today,
// writing streak. Refreshed when data changes and every 5 minutes (so the
// day rolling over is picked up); failures just leave the bar blank.
export function useStatusSummary(ready, dataVersion) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    const load = async () => {
      try {
        const today = completionsApi.todayISO();
        const [tasks, routines, completions, jlist] = await Promise.all([
          // Only what the bar shows: open tasks and today's check-offs.
          tasksApi.listOpenTasks(),
          routinesApi.listRoutines(),
          completionsApi.listCompletions({ since: today, extendStreaks: false, today }),
          runCapture('jlist', ['--tsv', '--type', 'daily']),
        ]);
        if (!live) return;
        setSummary({
          overdue: tasks.filter((t) => dueStatus(t) === 'overdue').length,
          dueToday: tasks.filter((t) => t.status !== 'done' && t.due_date === today).length,
          routinesDone: routines.filter((r) => (completions.get(r.id) || new Set()).has(today)).length,
          routines: routines.length,
          streak: jlist.ok ? writingStreak(parseEntries(jlist.stdout), today) : null,
        });
      } catch {
        // leave the previous summary
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [ready, dataVersion]);
  return summary;
}
