import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { C } from '../../lib/theme.js';

// A sparse, fixed scatter of dim dots and a few small stars for Home's empty
// space. Seeded, so it never jumps around between renders; it thins out
// toward the content on the left so it frames rather than competes.
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Starfield({ width, height, seed = 7 }) {
  const lines = useMemo(() => {
    const r = rand(seed * 7919 + width * 31 + height);
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, (_, x) => {
        const edge = x / Math.max(1, width); // 0 at the content side → 1 at the frame
        const p = r();
        if (p < 0.004 + edge * 0.012) return '✦';
        if (p < 0.015 + edge * 0.035) return '·';
        return ' ';
      }).join('')
    );
  }, [width, height, seed]);
  if (width < 4 || height < 1) return null;
  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      {lines.map((l, i) => (
        <Text key={i} color={C.muted} dimColor={false}>
          {l}
        </Text>
      ))}
    </Box>
  );
}
