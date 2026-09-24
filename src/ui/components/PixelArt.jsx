import { memo, useEffect, useState } from 'react';
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

function cells(art, legend, light, frame) {
  const set = light ? art.light : art.dark;
  const rows = Array.isArray(set[0]) ? set[frame % set.length] : set; // frames, or a single grid
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

// Steps through art.timeline ([frame, ms] pairs, looping) when it has one.
function useFrame(timeline, animate) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!timeline?.length || !animate) return undefined;
    const id = setTimeout(() => setStep((s) => (s + 1) % timeline.length), timeline[step][1]);
    return () => clearTimeout(id);
  }, [step, timeline, animate]);
  return timeline?.length ? timeline[step][0] : 0;
}

export const PixelArt = memo(function PixelArt({ art, legend, animate = true }) {
  const frame = useFrame(art.timeline, animate && !process.env.MAGNUS_STILL);
  const lines = cells(art, legend, isLightAppearance(), frame);
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
