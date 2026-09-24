import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Banner } from '../components/Banner.jsx';

const DESCRIPTIONS = {
  today: 'starred tasks, today’s routines, a quote',
  board: 'To Do · In Progress · Done',
  routines: 'morning / afternoon / evening, streaks',
  projects: 'status, target dates, checklists',
  library: 'books, highlights, favorite quotes',
  journal: 'daily entry, essays, search, capture',
  upcoming: 'overdue, today and the next 7 days',
  insights: 'tasks, routines, focus, mood and sleep trends',
  log: 'mood, energy, sleep, weight, workouts',
};

const HINTS = 'press a letter to open · ↑↓ enter · a quick add · ctrl+p or : actions · ctrl+k or / search · , settings · q quit';

export function Home({ gradient, sections }) {
  const { navigate, columns } = useAppCtx();
  const [index, setIndex] = useState(0);
  useHints(HINTS);

  useViewInput((input, key) => {
    const section = sections.find((s) => s.key === input);
    if (section) return navigate(section.view);
    if (key.upArrow) setIndex((i) => (i - 1 + sections.length) % sections.length);
    else if (key.downArrow) setIndex((i) => (i + 1) % sections.length);
    else if (key.return) navigate(sections[index].view);
  });

  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
      <Banner gradient={gradient} columns={columns} />
      <Text color={C.muted}>{date}</Text>
      <Box flexDirection="column" marginTop={1}>
        {sections.map((s, i) => (
          <Box key={s.view}>
            <Text color={i === index ? C.accent : undefined} bold={i === index}>
              {i === index ? '› ' : '  '}
              <Text color={C.accent} bold>
                [{s.key}]
              </Text>{' '}
              {s.label.padEnd(10)}
            </Text>
            <Text color={C.muted}>{DESCRIPTIONS[s.view]}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
