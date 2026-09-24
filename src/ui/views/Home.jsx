import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Banner } from '../components/Banner.jsx';
import { DuskRows, useDusk } from '../components/Dusk.jsx';
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

// Home's right side: the heron crossing the sun over a still lake, set into
// a dusk sky of cloud wisps and distant birds. Without room for the art, just
// the sky and lake.
const ART_WATERLINE = 12; // text row, within the art, where its water begins

function RightPanel({ width, height }) {
  const art = HERON_SUN;
  const rows = pixelRows(art);
  const fits = width >= art.width + 6 && height >= rows + 2;
  const top = fits ? Math.max(1, Math.floor((height - rows) / 2) - 1) : 0;
  const waterFrom = fits ? top + ART_WATERLINE : Math.floor(height * 0.62);
  const grid = useDusk(width, height, waterFrom);
  if (!fits) return <DuskRows grid={grid} y0={0} y1={height} />;
  const left = Math.floor((width - art.width) / 2);
  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      <DuskRows grid={grid} y0={0} y1={top} />
      <Box flexDirection="row">
        <DuskRows grid={grid} y0={top} y1={top + rows} x0={0} x1={left} />
        <PixelArt art={art} legend={HERON_SUN_LEGEND} />
        <DuskRows grid={grid} y0={top} y1={top + rows} x0={left + art.width} x1={width} />
      </Box>
      <DuskRows grid={grid} y0={top + rows} y1={height} />
    </Box>
  );
}
