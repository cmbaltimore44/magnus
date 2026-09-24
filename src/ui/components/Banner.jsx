import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { C, GRADIENT_FALLBACK } from '../../lib/theme.js';

// `gradient` holds the RGB values the terminal itself reported for the active
// theme family's signature slots (see lib/theme.js GRADIENT_SLOTS), so the
// wordmark follows the real theme. If the terminal didn't answer, cfonts'
// named ANSI colors for the same slots are used instead.
export function Banner({ gradient, columns }) {
  const font = columns >= 64 ? 'block' : columns >= 36 ? 'tiny' : null;
  if (!font) {
    return (
      <Text color={C.accent} bold>
        MAGNUS
      </Text>
    );
  }
  const text = <BigText text="MAGNUS" font={font} {...(gradient ? {} : { colors: GRADIENT_FALLBACK })} />;
  return <Box>{gradient ? <Gradient colors={gradient}>{text}</Gradient> : text}</Box>;
}
