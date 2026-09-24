import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Magnus's semantic colors, as named ANSI slots. The actual RGB comes from
// the terminal theme. Which family is active (set by `magnus-theme`) decides
// where the accent lives, since each theme puts its signature color in a
// different slot:
//   heather:      magenta = lilac accent, cyan = teal; gradient pale lilac →
//                 lilac → soft rose (bright magenta, magenta, bright red)
//   lakeglow:     bright red = coral sun accent; sunset gradient gold →
//                 coral → rose (bright yellow, bright red, bright magenta)
//   beacon:       bright red = sodium-streetlight orange accent; gradient fog
//                 blue → sodium orange → lamp yellow (bright blue/red/yellow)
//   hearth:       bright red = terracotta accent; gradient terracotta → amber
// Both: red = danger/overdue, yellow = warnings ("soon"), green = success,
// bright black ("gray") = muted text. `undefined` = terminal default.

export function activeFamily() {
  try {
    const family = fs.readFileSync(path.join(os.homedir(), '.config', 'magnus', 'terminal-theme'), 'utf8').trim() || 'hearth';
    return family === 'life-tracker' ? 'hearth' : family; // renamed; old state files still work
  } catch {
    return 'hearth';
  }
}

const FAMILY_ACCENTS = {
  heather: { accent: 'magenta', gradientSlots: [13, 5, 9], gradientFallback: ['magentaBright', 'magenta', 'redBright'] },
  lakeglow: { accent: 'redBright', gradientSlots: [11, 9, 13], gradientFallback: ['yellowBright', 'redBright', 'magentaBright'] },
  beacon: { accent: 'redBright', gradientSlots: [12, 9, 11], gradientFallback: ['blueBright', 'redBright', 'yellowBright'] },
  hearth: { accent: 'redBright', gradientSlots: [9, 3], gradientFallback: ['redBright', 'yellow'] },
};

export const FAMILY = FAMILY_ACCENTS[activeFamily()] ? activeFamily() : 'hearth';
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
