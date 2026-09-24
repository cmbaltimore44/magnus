import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Magnus's semantic colors, as named ANSI slots. The actual RGB comes from
// the terminal theme. Which family is active (set by `magnus-theme`) decides
// where the accent lives, since each theme puts its signature color in a
// different slot:
//   heather:      magenta = lilac accent, cyan = teal; gradient pale lilac →
//                 lilac → soft rose (bright magenta, magenta, bright red)
//   life-tracker: bright red = terracotta accent; gradient terracotta → amber
// Both: red = danger/overdue, yellow = warnings ("soon"), green = success,
// bright black ("gray") = muted text. `undefined` = terminal default.

export function activeFamily() {
  try {
    return fs.readFileSync(path.join(os.homedir(), '.config', 'magnus', 'terminal-theme'), 'utf8').trim() || 'life-tracker';
  } catch {
    return 'life-tracker';
  }
}

const FAMILY_ACCENTS = {
  heather: { accent: 'magenta', gradientSlots: [13, 5, 9], gradientFallback: ['magentaBright', 'magenta', 'redBright'] },
  'life-tracker': { accent: 'redBright', gradientSlots: [9, 3], gradientFallback: ['redBright', 'yellow'] },
};

export const FAMILY = FAMILY_ACCENTS[activeFamily()] ? activeFamily() : 'life-tracker';
const F = FAMILY_ACCENTS[FAMILY];

export const GRADIENT_SLOTS = F.gradientSlots;
export const GRADIENT_FALLBACK = F.gradientFallback;

export const C = {
  text: undefined,
  muted: 'gray',
  accent: F.accent,
  danger: 'red',
  overdue: 'red',
  soon: 'yellow',
  success: 'green',
  border: 'gray',
};
