import { Box, Text } from 'ink';
import wrapAnsi from 'wrap-ansi';
import { C } from '../../lib/theme.js';

// Quotes are shown in full, word-wrapped to the available width. Wrapping is
// done here (with the same wrap-ansi Ink uses) rather than left to Ink, so
// every quote's exact height is known up front and lists can scroll by real
// row counts instead of guesses.

export function wrapText(text, width) {
  return wrapAnsi(String(text ?? '').replace(/\r\n?/g, '\n'), Math.max(4, width), { hard: true, trim: true }).split('\n');
}

// Attributions are free text and often already start with a dash.
export function dashed(attribution) {
  if (!attribution) return '';
  return /^[—–-]/.test(attribution) ? attribution : `— ${attribution}`;
}

// Line layout for one quote. `indent` is the gutter before the quote text
// (selection marker + favorite star in lists), `attrIndent` before the
// attribution.
export function layoutQuote(quote, attribution, width, { indent = 4, attrIndent = 6 } = {}) {
  const quoteLines = wrapText(`“${quote.quote_text}”`, width - indent);
  const attrLines = attribution ? wrapText(dashed(attribution), width - attrIndent) : [];
  return { quoteLines, attrLines, height: quoteLines.length + attrLines.length, indent, attrIndent };
}

// A quote in a selectable list. `maxLines` only matters for a quote taller
// than the whole list area; it's clipped with a note rather than overflowing.
export function QuoteRow({ quote, layout, selected, maxLines = Infinity, gap = 0 }) {
  let { quoteLines, attrLines } = layout;
  let hidden = 0;
  if (layout.height + gap > maxLines) {
    const keep = Math.max(1, maxLines - gap - 1);
    hidden = layout.height - keep;
    quoteLines = quoteLines.slice(0, keep);
    attrLines = [];
  }
  const pad = ' '.repeat(layout.indent);
  return (
    <Box flexDirection="column" flexShrink={0} marginBottom={gap}>
      {quoteLines.map((line, i) => (
        <Text key={i}>
          {i === 0 ? (
            <>
              <Text color={C.accent}>{selected ? '› ' : '  '}</Text>
              <Text color={C.accent}>{quote.is_favorite ? '★ ' : '  '}</Text>
            </>
          ) : (
            pad
          )}
          <Text italic bold={selected} backgroundColor={selected ? C.hoverBg : undefined}>
            {line}
          </Text>
        </Text>
      ))}
      {attrLines.map((line, i) => (
        <Text key={`a${i}`} color={C.muted}>
          {' '.repeat(layout.attrIndent)}
          {line}
        </Text>
      ))}
      {hidden ? (
        <Text color={C.muted}>
          {pad}… {hidden} more line{hidden === 1 ? '' : 's'} (enter to open)
        </Text>
      ) : null}
    </Box>
  );
}

// The featured quote on Today: no list gutter, lives inside a bordered box.
export function QuoteBlock({ layout }) {
  return (
    <>
      {layout.quoteLines.map((line, i) => (
        <Text key={i} italic>
          {line}
        </Text>
      ))}
      {layout.attrLines.map((line, i) => (
        <Text key={`a${i}`} color={C.muted}>
          {line}
        </Text>
      ))}
    </>
  );
}
