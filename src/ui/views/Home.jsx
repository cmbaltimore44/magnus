import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Banner } from '../components/Banner.jsx';
import { Starfield } from '../components/Starfield.jsx';
import { PixelArt, pixelRows } from '../components/PixelArt.jsx';
import { HERON_SUN, HERON_SUN_LEGEND } from '../art/heronSun.js';

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
  lists: 'groceries, wish list, anything you keep',
};

const HINTS = 'press a letter to open · ↑↓ enter · a quick add · ctrl+p or : actions · ctrl+k or / search · , settings · q quit';

export function Home({ gradient, sections }) {
  const { navigate, columns, contentHeight } = useAppCtx();
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

  // Menu width: "› [x] Label     description"; the starfield takes what's left.
  const menuWidth = 3 + 4 + 10 + Math.max(...sections.map((s) => (DESCRIPTIONS[s.view] || '').length));
  const bannerWidth = columns >= 64 ? 60 : 30;
  const leftWidth = Math.max(menuWidth, bannerWidth) + 3;
  const fieldWidth = columns - 2 - leftWidth;

  return (
    <Box flexDirection="row">
    <Box flexDirection="column" paddingTop={1} paddingLeft={1} width={leftWidth} flexShrink={0}>
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
    {fieldWidth >= 8 ? <RightPanel width={fieldWidth} height={contentHeight + 1} /> : null}
    </Box>
  );
}

// Home's right side: the starfield, with the heron crossing the sun set into
// it when there's room (otherwise just the stars).
function RightPanel({ width, height }) {
  const art = HERON_SUN;
  const rows = pixelRows(art);
  if (width < art.width + 6 || height < rows + 2) return <Starfield width={width} height={height} />;
  const top = Math.max(1, Math.floor((height - rows) / 2) - 1);
  const left = Math.floor((width - art.width) / 2);
  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      <Starfield width={width} height={top} seed={3} />
      <Box flexDirection="row">
        <Starfield width={left} height={rows} seed={5} />
        <PixelArt art={art} legend={HERON_SUN_LEGEND} />
        <Starfield width={width - left - art.width} height={rows} seed={9} />
      </Box>
      <Starfield width={width} height={height - top - rows} seed={11} />
    </Box>
  );
}
