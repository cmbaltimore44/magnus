// Shared by the theme generators (build-web.mjs, build-obsidian.mjs): the
// families, color math, and the surface/text colors derived from each
// family's finished Ghostty theme, so every app gets the same tuned colors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Families in picker order. roles = ANSI slots for each web color.
export const FAMILIES = [
  { key: 'hearth', label: 'Hearth', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'heather', label: 'Heather', roles: { accent: 5, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'lakeglow', label: 'Lakeglow', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'beacon', label: 'Beacon', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
];
export const GHOSTTY_NAME = { hearth: 'Hearth', heather: 'Heather', lakeglow: 'Lakeglow', beacon: 'Beacon' };

// ---------- color math ----------
export const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => toHex(toRgb(a).map((x, i) => x * t + toRgb(b)[i] * (1 - t)));
export function lum(h) {
  const [r, g, b] = toRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Strongest shade from `base` toward `toward` (up to `max`) keeping every
// text color >= 4.5:1 on it.
export function safeShade(base, toward, max, texts) {
  let t = max;
  while (t > 0 && Math.min(...texts.map((c) => contrast(c, mix(toward, base, t)))) < 4.5) t -= 0.005;
  return mix(toward, base, Math.max(0, t));
}
export const bestOn = (fill, candidates) => candidates.reduce((a, b) => (contrast(b, fill) > contrast(a, fill) ? b : a));

export function readGhostty(file) {
  const t = { pal: [] };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let m = /^palette = (\d+)=(#[0-9a-f]{6})/i.exec(line);
    if (m) t.pal[+m[1]] = m[2].toLowerCase();
    m = /^(background|foreground) = (#[0-9a-f]{6})/i.exec(line);
    if (m) t[m[1] === 'background' ? 'bg' : 'fg'] = m[2].toLowerCase();
  }
  return t;
}


// Everything derived for one family and mode (see build-web.mjs for how
// each is used): the Ghostty colors g, the role colors r, and the surfaces
// chosen so every text color stays >= 4.5:1 on them.
export function familyColors(fam, mode) {
  const file = path.join(ROOT, fam.key, 'ghostty', `${GHOSTTY_NAME[fam.key]} ${mode === 'dark' ? 'Dark' : 'Light'}`);
  const g = readGhostty(file);
  const r = Object.fromEntries(Object.entries(fam.roles).map(([k, slot]) => [k, g.pal[slot]]));
  const dark = mode === 'dark';
  const texts = [g.fg, r.muted, r.accent, r.error, r.warning, r.success];

  // Dark: cards/hover lift toward the text color (as far as contrast allows),
  // the sidebar sinks darker. Light: cards/hover/sidebar move toward white.
  const surface = dark ? safeShade(g.bg, g.fg, 0.06, texts) : safeShade(g.bg, '#ffffff', 0.5, texts);
  let hover = dark ? safeShade(g.bg, g.fg, 0.1, texts) : safeShade(g.bg, '#ffffff', 0.22, texts);
  // If contrast headroom leaves the lifted hover indistinguishable from the
  // cards, sink it darker instead (darker only raises text contrast).
  if (dark && contrast(hover, surface) < 1.08) hover = mix('#000000', g.bg, 0.38);
  // Board columns tint the page with --surface-subtle; the current-book row
  // with --accent-tint. Both as strong as allowed (3% / 8%) while every text
  // color stays >= 4.5:1 on them.
  // (It's translucent and sits on the page or on cards, so check both, with
  // a little margin for the browser's own rounding when it blends.)
  let subtleTo = dark ? '#ffffff' : '#000000';
  const subtleOk = (a) => Math.min(...texts.flatMap((c) => [g.bg, surface].map((base) => contrast(c, mix(subtleTo, base, a))))) >= 4.55;
  let subtleAlpha = 0.03;
  while (subtleAlpha > 0 && !subtleOk(subtleAlpha)) subtleAlpha -= 0.0025;
  subtleAlpha = Math.max(0, Math.round(subtleAlpha * 10000) / 10000);
  // No headroom to lift (dark themes whose colors sit right at 4.5:1): sink
  // the columns instead, which only raises contrast for light text.
  if (dark && subtleAlpha < 0.02) {
    subtleTo = '#000000';
    subtleAlpha = 0.18;
  }
  const subtle = mix(subtleTo, g.bg, subtleAlpha);
  const accentTint = safeShade(g.bg, r.accent, 0.08, texts);
  const sidebar = dark ? mix('#000000', g.bg, 0.22) : safeShade(g.bg, '#ffffff', 0.12, texts);
  const border = mix(g.fg, g.bg, dark ? 0.14 : 0.13);
  const accentHover = dark ? mix('#ffffff', r.accent, 0.14) : mix('#000000', r.accent, 0.14);
  const dangerHover = dark ? mix('#ffffff', r.error, 0.14) : mix('#000000', r.error, 0.14);
  const onAccent = bestOn(r.accent, [g.bg, '#ffffff', g.fg]);
  const onDanger = bestOn(r.error, [g.bg, '#ffffff', g.fg]);

  return { g, r, dark, texts, surface, hover, subtleTo, subtleAlpha, subtle, accentTint, sidebar, border, accentHover, dangerHover, onAccent, onDanger };
}
