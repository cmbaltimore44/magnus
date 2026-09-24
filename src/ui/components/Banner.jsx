import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { C } from '../../lib/theme.js';

// `gradient` holds the RGB values the terminal itself reported for its bright
// red and yellow slots (see lib/palette.js) — terracotta → amber under the
// Life Tracker Ghostty themes — so the wordmark follows the active theme. If
// the terminal didn't answer, cfonts' named ANSI colors are used instead.
export function Banner({ gradient, columns }) {
  const font = columns >= 64 ? 'block' : columns >= 36 ? 'tiny' : null;
  if (!font) {
    return (
      <Text color={C.accent} bold>
        MAGNUS
      </Text>
    );
  }
  const text = <BigText text="MAGNUS" font={font} {...(gradient ? {} : { colors: ['redBright', 'yellow'] })} />;
  return <Box>{gradient ? <Gradient colors={gradient}>{text}</Gradient> : text}</Box>;
}
