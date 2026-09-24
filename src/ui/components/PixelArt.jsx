import { memo } from 'react';
import { Box, Text } from 'ink';
import { FAMILY, isLightAppearance } from '../../lib/theme.js';

// Pixel art from art/figures.py (exported by art/export.py), drawn with half
// blocks: each character cell holds two pixels, the top one as the
// foreground of '▀' and the bottom one as its background. Only the theme's
// named colors are used, so the art follows the theme like everything else.
const INK = {
  black: 'black', red: 'red', green: 'green', yellow: 'yellow', blue: 'blue', magenta: 'magenta', cyan: 'cyan', white: 'white',
  gray: 'gray', redB: 'redBright', greenB: 'greenBright', yellowB: 'yellowBright', blueB: 'blueBright',
  magentaB: 'magentaBright', cyanB: 'cyanBright', whiteB: 'whiteBright',
};

// Per-theme touch-ups, where a slot reads differently in one family.
const FAMILY_TONES = {
  heather: { dark: { yellowB: 'whiteB' } }, // Heather's bright yellow is a muted khaki; a pale sun core suits its pink ring
};

function cells(art, legend, light) {
  const rows = light ? art.light : art.dark;
  const swap = FAMILY_TONES[FAMILY]?.[light ? 'light' : 'dark'] || {};
  const tone = (ch) => {
    const t = legend[ch];
    return t ? INK[swap[t] || t] : null;
  };
  const lines = [];
  for (let y = 0; y < rows.length; y += 2) {
    const top = rows[y];
    const bottom = rows[y + 1] || '.'.repeat(art.width);
    const runs = [];
    for (let x = 0; x < art.width; x++) {
      const t = tone(top[x]);
      const b = tone(bottom[x]);
      const cell = !t && !b ? { ch: ' ' } : !t ? { ch: '▄', fg: b } : !b || t === b ? { ch: b && t === b ? '█' : '▀', fg: t } : { ch: '▀', fg: t, bg: b };
      const last = runs[runs.length - 1];
      if (last && last.fg === cell.fg && last.bg === cell.bg && (last.ch === cell.ch || (cell.ch === ' ' && last.ch.trim() === ''))) last.text += cell.ch;
      else runs.push({ ...cell, text: cell.ch });
    }
    lines.push(runs);
  }
  return lines;
}

export const PixelArt = memo(function PixelArt({ art, legend }) {
  const lines = cells(art, legend, isLightAppearance());
  return (
    <Box flexDirection="column" flexShrink={0} width={art.width}>
      {lines.map((runs, i) => (
        <Text key={i}>
          {runs.map((r, k) =>
            r.fg || r.bg ? (
              <Text key={k} color={r.fg} backgroundColor={r.bg}>
                {r.text}
              </Text>
            ) : (
              <Text key={k}>{r.text}</Text>
            )
          )}
        </Text>
      ))}
    </Box>
  );
});

export const pixelRows = (art) => Math.ceil(art.height / 2);
