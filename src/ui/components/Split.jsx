import { Box, Text } from 'ink';
import { C } from '../../lib/theme.js';

// List + detail side by side on wide windows. Views keep their list layout
// and just compute widths from `listColumns` instead of the full width.
export const SPLIT_MIN_COLUMNS = 140;

export function splitLayout(columns) {
  const split = columns >= SPLIT_MIN_COLUMNS;
  const listColumns = split ? Math.floor(columns * 0.5) : columns;
  return { split, listColumns, previewWidth: columns - listColumns - 1 };
}

export function Split({ layout, height, children, preview }) {
  if (!layout.split) return children;
  return (
    <Box flexDirection="row" height={height}>
      <Box width={layout.listColumns - 2} flexShrink={0} flexDirection="column" overflow="hidden">
        {children}
      </Box>
      <Box
        width={layout.previewWidth}
        marginLeft={1}
        flexDirection="column"
        borderStyle="round"
        borderColor={C.border}
        paddingX={1}
        overflow="hidden"
        height={height}
      >
        {preview || <Text color={C.muted}>Nothing selected.</Text>}
      </Box>
    </Box>
  );
}
