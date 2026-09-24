import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

// `gradient` holds RGB values the terminal itself reported for its magenta,
// blue and cyan palette slots (see lib/palette.js), so the wordmark is always
// painted in the current Ghostty theme's colors. If the terminal didn't
// answer, fall back to cfonts' named ANSI colors — still theme-driven.
export function Banner({ gradient, columns }) {
  const font = columns >= 64 ? 'block' : columns >= 36 ? 'tiny' : null;
  if (!font) {
    return (
      <Text color="magenta" bold>
        MAGNUS
      </Text>
    );
  }
  const text = <BigText text="MAGNUS" font={font} {...(gradient ? {} : { colors: ['magenta', 'cyan'] })} />;
  return <Box>{gradient ? <Gradient colors={gradient}>{text}</Gradient> : text}</Box>;
}
