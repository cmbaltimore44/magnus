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

export const BACKDROPS = ['dusk', 'marsh', 'mountains', 'plain'];
export const BACKDROP_LABELS = { dusk: 'Dusk sky and lake', marsh: 'Marsh', mountains: 'Mountains', plain: 'Plain' };

function marshGrid(width, height, waterFrom, r) {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  const put = (x, y, ch, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = { ch, color };
  };
  const density = (x) => 0.2 + 0.8 * (x / Math.max(1, width));
  // a far tree line along the horizon
  let h = 1;
  for (let x = 0; x < width; x++) {
    h = Math.max(0, Math.min(3, h + (r() < 0.5 ? -1 : 1) * (r() < 0.6 ? 1 : 0)));
    if (r() < density(x) + 0.2) put(x, waterFrom, ' ▁▂▃'[h] || '▂', C.muted);
  }
  // a little open water below it
  for (let y = waterFrom + 1; y < height; y++) {
    for (let i = 0; i < Math.floor(width / 12); i++) {
      const x = Math.floor(r() * width);
      if (r() < density(x) * 0.7) put(x, y, r() < 0.5 ? '~' : '‿', 'blue');
    }
  }
  // reeds and cattails rising from the bottom edge, thicker toward the frame
  for (let x = 0; x < width; x++) {
    if (r() > density(x) * 0.55) continue;
    const tall = 2 + Math.floor(r() * Math.min(7, Math.max(2, height - waterFrom - 1)));
    for (let k = 0; k < tall; k++) put(x, height - 1 - k, k === tall - 1 && r() < 0.5 ? '╽' : '┃', 'green');
    if (r() < 0.35) put(x, height - tall, '▮', 'yellow');                        // cattail head
    else if (r() < 0.3) put(x + 1, height - tall + 1, '╱', 'green');                // a leaning blade
  }
  for (let i = 0; i < 2; i++) put(Math.floor(width * (0.5 + r() * 0.45)), Math.floor(r() * waterFrom * 0.45), 'ᵛ', C.muted);
  return grid;
}

function mountainGrid(width, height, waterFrom, r) {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  const put = (x, y, ch, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = { ch, color };
  };
  const blocks = ' ▁▂▃▄▅▆▇█';
  const p = [r() * 6, r() * 6, r() * 6];
  // a smooth ridge profile (sum of waves), in eighths of a row, sitting on the horizon
  for (let x = 0; x < width; x++) {
    const t = x / Math.max(1, width);
    const ridge = 10 + 9 * Math.sin(t * 5 + p[0]) + 5 * Math.sin(t * 13 + p[1]) + 3 * Math.sin(t * 29 + p[2]);
    const eighths = Math.max(2, Math.round(ridge * (0.4 + 0.6 * t)));            // lower toward the menu
    const full = Math.floor(eighths / 8);
    for (let k = 0; k < full; k++) put(x, waterFrom - 1 - k, '█', C.muted);
    if (eighths % 8) put(x, waterFrom - 1 - full, blocks[eighths % 8], C.muted);
  }
  for (let y = waterFrom; y < height; y++) {                                     // the lake below
    for (let i = 0; i < Math.floor(width / 11); i++) {
      const x = Math.floor(r() * width);
      if (r() < (0.3 + 0.7 * x / width) * (1 - (y - waterFrom) / Math.max(2, height - waterFrom))) put(x, y, r() < 0.5 ? '~' : '‿', 'blue');
    }
  }
  for (let i = 0; i < 3; i++) put(Math.floor(width * (0.45 + r() * 0.5)), Math.floor(r() * (waterFrom - 5) * 0.6), 'ᵛ', C.muted);
  return grid;
}

export function backdropGrid(kind, width, height, waterFrom, seed = 21) {
  const r = rand(seed * 7919 + width * 31 + height);
  if (kind === 'marsh') return marshGrid(width, height, waterFrom, r);
  if (kind === 'mountains') return mountainGrid(width, height, waterFrom, r);
  if (kind === 'plain') return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  return duskGrid(width, height, waterFrom, seed);
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

export function useBackdrop(kind, width, height, waterFrom) {
  return useMemo(() => backdropGrid(kind, width, height, waterFrom), [kind, width, height, waterFrom]);
}
