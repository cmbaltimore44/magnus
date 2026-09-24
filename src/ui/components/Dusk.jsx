import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { C } from '../../lib/theme.js';

// Home's backdrop behind the heron: an evening sky and a still lake. Above
// the waterline, a few thin cloud wisps and distant birds in muted gray;
// below it, faint ripples in blue. Fixed (seeded) so it never jumps around,
// and it thins out toward the menu on the left.
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function duskGrid(width, height, waterFrom, seed = 21) {
  const r = rand(seed * 7919 + width * 31 + height);
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  const put = (x, y, ch, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height && !grid[y][x]) grid[y][x] = { ch, color };
  };
  const density = (x) => 0.25 + 0.75 * (x / Math.max(1, width)); // sparser toward the menu
  for (let y = 0; y < height; y++) {
    if (y < waterFrom) {
      // sky: wisps a few cells long, more of them high up
      if (r() < 0.55 * (1 - y / Math.max(1, waterFrom)) + 0.1) {
        const x = Math.floor(r() * width);
        if (r() < density(x)) {
          const len = 2 + Math.floor(r() * 5);
          for (let k = 0; k < len; k++) put(x + k, y, k === 0 || k === len - 1 ? '╌' : '─', C.muted);
        }
      }
    } else if (y > waterFrom) {
      // lake: short ripple dashes, a little denser near the waterline
      const n = Math.floor(width / 9);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(r() * width);
        if (r() < density(x) * (1 - (y - waterFrom) / Math.max(2, height - waterFrom)) * 0.9) put(x, y, r() < 0.5 ? '~' : '‿', 'blue');
      }
    } else {
      // the far shore line, faint and broken
      for (let x = 0; x < width; x++) if (r() < 0.35 * density(x)) put(x, y, '▁', 'blue');
    }
  }
  // two or three distant birds in the upper sky
  const birds = 2 + Math.floor(r() * 2);
  for (let i = 0; i < birds; i++) {
    const x = Math.floor(width * (0.45 + r() * 0.5));
    const y = Math.floor(r() * Math.max(1, waterFrom * 0.5));
    put(x, y, 'ᵛ', C.muted);
  }
  return grid;
}

// Draw a rectangle of the grid: rows [y0, y1), columns [x0, x1).
export function DuskRows({ grid, y0, y1, x0 = 0, x1 }) {
  const lines = [];
  for (let y = y0; y < y1; y++) {
    const row = grid[y] || [];
    const end = x1 ?? row.length;
    const runs = [];
    for (let x = x0; x < end; x++) {
      const c = row[x];
      const color = c?.color || null;
      const last = runs[runs.length - 1];
      if (last && last.color === color) last.text += c ? c.ch : ' ';
      else runs.push({ color, text: c ? c.ch : ' ' });
    }
    lines.push(runs);
  }
  return (
    <Box flexDirection="column" flexShrink={0} width={Math.max(0, (x1 ?? grid[0]?.length ?? 0) - x0)}>
      {lines.map((runs, i) => (
        <Text key={i}>
          {runs.map((r, k) => (r.color ? <Text key={k} color={r.color}>{r.text}</Text> : <Text key={k}>{r.text}</Text>))}
        </Text>
      ))}
    </Box>
  );
}

export function useDusk(width, height, waterFrom) {
  return useMemo(() => duskGrid(width, height, waterFrom), [width, height, waterFrom]);
}
