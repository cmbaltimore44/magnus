import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { toISO } from '../../lib/data/completions.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Heatmap levels in terminal colors: empty days are a gray dot, then amber
// → terracotta as the day fills up (web: accent ramp).
const LEVELS = [
  { color: C.muted, char: '·' },
  { color: C.soon, char: '■' },
  { color: C.soon, char: '■', bold: true },
  { color: C.accent, char: '■' },
  { color: C.accent, char: '■', bold: true },
];

// GitHub-style calendar, weeks as columns ending this week.
// levelFor(isoDate) → 0-4; footer(activeDays, weeks) → text.
export function CalendarHeatmap({ title, columns, levelFor, footer, maxWeeks = 53 }) {
  const weeks = Math.max(4, Math.min(maxWeeks, Math.floor((columns - 10) / 2)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gridEnd = new Date(today);
  gridEnd.setDate(gridEnd.getDate() + (6 - today.getDay()));
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridStart.getDate() - (weeks * 7 - 1));

  const grid = Array.from({ length: 7 }, () => []);
  const monthChars = Array(weeks * 2).fill(' ');
  let lastMonth = -1;
  let activeDays = 0;
  const cursor = new Date(gridStart);

  for (let w = 0; w < weeks; w++) {
    if (cursor.getMonth() !== lastMonth) {
      lastMonth = cursor.getMonth();
      const label = MONTH_NAMES[lastMonth];
      const at = w * 2;
      if (at + label.length <= monthChars.length) {
        // A partial first month whose label would collide with this one gives way.
        if (at > 0 && monthChars[at - 1] !== ' ') for (let k = at - 1; k >= 0 && monthChars[k] !== ' '; k--) monthChars[k] = ' ';
        [...label].forEach((ch, k) => (monthChars[at + k] = ch));
      }
    }
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        grid[d].push(-1);
      } else {
        const level = levelFor(toISO(cursor));
        grid[d].push(level);
        if (level > 0) activeDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const dayLabels = ['   ', 'Mon', '   ', 'Wed', '   ', 'Fri', '   '];

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Text bold color={C.accent}>
        {title}
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
      <Text color={C.muted}>{footer ? footer(activeDays, weeks) : ''}</Text>
    </Box>
  );
}
