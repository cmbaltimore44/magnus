import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { C } from '../../lib/theme.js';

// Life Tracker's accent → amber, from the active light/dark palette.
export function Banner({ columns }) {
  const font = columns >= 64 ? 'block' : columns >= 36 ? 'tiny' : null;
  if (!font) {
    return (
      <Text color={C.accent} bold>
        MAGNUS
      </Text>
    );
  }
  return (
    <Box>
      <Gradient colors={[C.accent, C.soon]}>
        <BigText text="MAGNUS" font={font} />
      </Gradient>
    </Box>
  );
}
