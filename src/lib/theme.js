// Life Tracker's color scheme, copied verbatim from the web app's style.css
// (`:root` = light, `[data-theme="dark"]` = dark). Every color Magnus draws
// comes from here; `C` is filled in once at startup (see setThemeMode) based
// on whether the terminal background is light or dark.
//
// If the web app's palette changes, update these values to match.

export const PALETTES = {
  light: {
    bg: '#f2e2d6',
    surface: '#f8eee5',
    border: '#e2cfbd',
    text: '#2b2420',
    muted: '#93887a',
    accent: '#bf5433',
    accentHover: '#a8452a',
    danger: '#b83b2e',
    overdue: '#b83b2e',
    soon: '#b8791a',
    success: '#5c7a49',
    hoverBg: '#ecdcc9',
  },
  dark: {
    bg: '#211c18',
    surface: '#292320',
    border: '#3c332b',
    text: '#ece2d6',
    muted: '#998c7d',
    accent: '#e2703f',
    accentHover: '#ec8455',
    danger: '#d9584a',
    overdue: '#d9584a',
    soon: '#e0a83a',
    success: '#82a86a',
    hoverBg: '#332b23',
  },
};

export const C = { mode: 'dark', ...PALETTES.dark };

export function setThemeMode(mode) {
  Object.assign(C, PALETTES[mode === 'light' ? 'light' : 'dark'], { mode: mode === 'light' ? 'light' : 'dark' });
}

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Same as CSS `color-mix(in srgb, a <t>, b)`.
export function mix(a, b, t) {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  const ch = (x, y) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

export function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

// Relative luminance < 0.5 → treat the terminal as dark.
export function modeForBackground(hex) {
  if (!isHexColor(hex)) return null;
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? 'dark' : 'light';
}

// OSC 10/11 set the terminal's default foreground/background, so areas Ink
// doesn't paint (e.g. Ghostty's window padding) match too. OSC 110/111 put
// the user's own theme back — on exit and while a child program has the
// terminal.
export function terminalColorsOn() {
  return `\x1b]10;${C.text}\x07\x1b]11;${C.bg}\x07`;
}
export const TERMINAL_COLORS_RESET = '\x1b]110\x07\x1b]111\x07';
