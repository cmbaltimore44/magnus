#!/usr/bin/env node
// Generate the Life Tracker web app's theme CSS from the terminal themes:
//   node terminal-theme/tools/build-web.mjs <life-tracker-repo-dir>
//
// Reads each family's finished Ghostty theme files (so the web app gets
// exactly the same, contrast-tuned colors as the terminal) and writes:
//   <dir>/themes.css       CSS variables per family and light/dark mode
//   <dir>/js/palettes.js   the list of families, for the theme picker
// and then runs <dir>/scripts/generate-icon.py to redraw the per-theme icons.
//
// The web app styles everything through the CSS variables in its style.css;
// these blocks override them via html[data-palette="…"][data-theme="…"].
// Card, sidebar and hover shades are chosen so every text color stays
// >= 4.5:1 on them, and button text is whichever of the page background or
// white reads best on the accent/danger color. A contrast report is printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: build-web.mjs <life-tracker-repo-dir>');
  process.exit(1);
}

// Families in picker order. roles = ANSI slots for each web color.
const FAMILIES = [
  { key: 'hearth', label: 'Hearth', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'heather', label: 'Heather', roles: { accent: 5, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'lakeglow', label: 'Lakeglow', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
  { key: 'beacon', label: 'Beacon', roles: { accent: 9, error: 1, warning: 3, success: 2, muted: 8 } },
];
const GHOSTTY_NAME = { hearth: 'Hearth', heather: 'Heather', lakeglow: 'Lakeglow', beacon: 'Beacon' };

// ---------- color math ----------
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(toRgb(a).map((x, i) => x * t + toRgb(b)[i] * (1 - t)));
function lum(h) {
  const [r, g, b] = toRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Strongest shade from `base` toward `toward` (up to `max`) keeping every
// text color >= 4.5:1 on it.
function safeShade(base, toward, max, texts) {
  let t = max;
  while (t > 0 && Math.min(...texts.map((c) => contrast(c, mix(toward, base, t)))) < 4.5) t -= 0.005;
  return mix(toward, base, Math.max(0, t));
}
const bestOn = (fill, candidates) => candidates.reduce((a, b) => (contrast(b, fill) > contrast(a, fill) ? b : a));

function readGhostty(file) {
  const t = { pal: [] };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let m = /^palette = (\d+)=(#[0-9a-f]{6})/i.exec(line);
    if (m) t.pal[+m[1]] = m[2].toLowerCase();
    m = /^(background|foreground) = (#[0-9a-f]{6})/i.exec(line);
    if (m) t[m[1] === 'background' ? 'bg' : 'fg'] = m[2].toLowerCase();
  }
  return t;
}

// ---------- build ----------
const blocks = [];
const report = [];
for (const fam of FAMILIES) {
  for (const mode of ['light', 'dark']) {
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
    const sidebar = dark ? mix('#000000', g.bg, 0.22) : safeShade(g.bg, '#ffffff', 0.12, texts);
    const border = mix(g.fg, g.bg, dark ? 0.14 : 0.13);
    const accentHover = dark ? mix('#ffffff', r.accent, 0.14) : mix('#000000', r.accent, 0.14);
    const dangerHover = dark ? mix('#ffffff', r.error, 0.14) : mix('#000000', r.error, 0.14);
    const onAccent = bestOn(r.accent, [g.bg, '#ffffff', g.fg]);
    const onDanger = bestOn(r.error, [g.bg, '#ffffff', g.fg]);

    const vars = {
      '--bg': g.bg,
      '--surface': surface,
      '--sidebar-bg': sidebar,
      '--surface-subtle': dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      '--border': border,
      '--text': g.fg,
      '--text-muted': r.muted,
      '--accent': r.accent,
      '--accent-hover': accentHover,
      '--on-accent': onAccent,
      '--danger': r.error,
      '--danger-hover': dangerHover,
      '--on-danger': onDanger,
      '--overdue': r.error,
      '--soon': r.warning,
      '--success': r.success,
      '--chip-bg': dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      '--hover-bg': hover,
      '--overlay-bg': dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)',
      '--modal-shadow': dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.18)',
      '--toast-shadow': dark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.14)',
      '--theme-color': g.bg,
    };
    const selector = dark ? `html[data-palette="${fam.key}"][data-theme="dark"]` : `html[data-palette="${fam.key}"]`;
    blocks.push(`/* ${fam.label} — ${mode} */\n${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`);

    const worst = Math.min(...texts.flatMap((c) => [g.bg, surface, hover, sidebar].map((b) => contrast(c, b))));
    report.push(
      `${fam.label.padEnd(12)} ${mode.padEnd(5)} text/muted/accent/danger/soon/success on bg, cards, sidebar, hover >= ${worst.toFixed(2)}:1; ` +
        `button text on accent ${contrast(onAccent, r.accent).toFixed(1)}:1, on danger ${contrast(onDanger, r.error).toFixed(1)}:1`
    );
  }
}

const header = `/* Generated by the Magnus repo: terminal-theme/tools/build-web.mjs.
 * Do not edit by hand — change the terminal themes there and regenerate.
 * Each theme sets the same CSS variables style.css uses. Light values apply
 * via html[data-palette="…"]; dark via html[data-palette="…"][data-theme="dark"].
 * js/theme-boot.js sets both attributes. */\n\n`;
fs.writeFileSync(path.join(outDir, 'themes.css'), header + blocks.join('\n\n') + '\n');
fs.writeFileSync(
  path.join(outDir, 'js', 'palettes.js'),
  `// Generated by the Magnus repo: terminal-theme/tools/build-web.mjs. Do not edit by hand.\n` +
    `export const PALETTES = ${JSON.stringify(FAMILIES.map(({ key, label }) => ({ key, label })), null, 2)};\n` +
    `export const DEFAULT_PALETTE = 'hearth';\n`
);
console.log(report.join('\n'));
console.log(`Wrote ${path.join(outDir, 'themes.css')} and ${path.join(outDir, 'js', 'palettes.js')}`);

// The web app's per-theme icons are drawn from themes.css by its own script.
const iconScript = path.join(outDir, 'scripts', 'generate-icon.py');
if (fs.existsSync(iconScript)) {
  execFileSync('python3', [iconScript], { stdio: 'inherit' });
}
