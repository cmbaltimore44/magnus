#!/usr/bin/env node
// Generate Obsidian themes from the terminal themes:
//   node terminal-theme/tools/build-obsidian.mjs [vault-dir]   (default $JOURNAL_DIR or ~/journal)
//
// Writes <vault>/.obsidian/themes/<Family>/{manifest.json,theme.css} for each
// family, with light and dark in one theme (Obsidian's Appearance setting
// picks the mode). Choose one under Settings → Appearance → Themes; "Default"
// there goes back to Obsidian's own look.
//
// Colors come from the same tuned values as the web app (colors.mjs). Text
// colors only ever sit on backgrounds they keep >= 4.5:1 on, and Obsidian's
// deliberately faint text (labels, unresolved links) is raised to the muted
// color for the same reason. A contrast report is printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAMILIES, familyColors, contrast, mix, safeShade, toRgb } from './colors.mjs';

const vault = process.argv[2] || process.env.JOURNAL_DIR || path.join(os.homedir(), 'journal');
if (!fs.existsSync(vault)) {
  console.error(`build-obsidian: no folder at ${vault}`);
  process.exit(1);
}

// hex → Obsidian's --accent-h/-s/-l (used by a few derived accent shades).
function hsl(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), s, l];
}

function variables(fam, mode) {
  const c = familyColors(fam, mode);
  const { g, r } = c;
  const p = g.pal;
  // Obsidian's grey scale, from the page background (00) to the text (100).
  const steps = { '00': 0, '05': 0.02, '10': 0.04, '20': 0.07, '25': 0.1, '30': 0.13, '35': 0.17, '40': 0.28, '50': 0.4, '60': 0.55, '70': 0.7, '100': 1 };
  const base = Object.fromEntries(Object.entries(steps).map(([k, t]) => [`--color-base-${k}`, mix(g.fg, g.bg, t)]));
  // ==highlight== behind normal text: the warning color, as strong as contrast allows.
  const highlight = safeShade(g.bg, r.warning, 0.35, [g.fg]);
  const [h, s, l] = hsl(r.accent);
  return {
    ...base,
    '--color-red': p[1], '--color-orange': p[9], '--color-yellow': p[3], '--color-green': p[2],
    '--color-cyan': p[6], '--color-blue': p[4], '--color-purple': p[5], '--color-pink': p[13],
    '--accent-h': `${h}`, '--accent-s': `${(s * 100).toFixed(1)}%`, '--accent-l': `${(l * 100).toFixed(1)}%`,
    '--color-accent': r.accent, '--color-accent-1': c.accentHover, '--color-accent-2': c.accentHover,

    '--background-primary': g.bg,
    '--background-primary-alt': c.surface,
    '--background-secondary': c.sidebar,
    '--background-secondary-alt': c.sidebar,
    '--background-modifier-hover': c.hover,
    '--background-modifier-active-hover': c.hover,
    '--background-modifier-border': c.border,
    '--background-modifier-border-hover': mix(g.fg, g.bg, 0.24),
    '--background-modifier-border-focus': r.accent,
    '--background-modifier-form-field': c.surface,
    '--background-modifier-error': r.error,
    '--background-modifier-success': r.success,
    '--interactive-normal': c.surface,
    '--interactive-hover': c.hover,
    '--interactive-accent': r.accent,
    '--interactive-accent-hover': c.accentHover,

    '--text-normal': g.fg,
    '--text-muted': r.muted,
    '--text-faint': r.muted,
    '--text-accent': r.accent,
    '--text-accent-hover': c.accentHover,
    '--text-on-accent': c.onAccent,
    '--text-on-accent-inverted': c.onAccent,
    '--text-error': r.error,
    '--text-warning': r.warning,
    '--text-success': r.success,
    '--text-selection': c.accentTint,
    '--text-highlight-bg': highlight,
    '--caret-color': r.accent,

    '--h1-color': r.accent, '--h2-color': r.accent,
    '--h3-color': g.fg, '--h4-color': g.fg, '--h5-color': g.fg, '--h6-color': g.fg,
    '--link-color': r.accent, '--link-color-hover': c.accentHover,
    '--link-external-color': r.accent, '--link-external-color-hover': c.accentHover,
    '--link-unresolved-color': r.accent, '--link-unresolved-opacity': '1',
    '--link-unresolved-decoration-style': 'dashed',
    '--tag-color': r.accent, '--tag-color-hover': r.accent,
    '--tag-background': c.accentTint, '--tag-background-hover': c.accentTint,
    '--blockquote-border-color': r.accent,
    '--hr-color': c.border,
    '--checkbox-color': r.accent, '--checkbox-color-hover': c.accentHover,
    '--checkbox-marker-color': c.onAccent,
    '--checkbox-border-color': r.muted, '--checkbox-border-color-hover': g.fg,

    '--code-normal': g.fg, '--code-background': c.surface, '--code-comment': r.muted,
    '--code-keyword': p[5], '--code-string': p[2], '--code-function': p[4], '--code-value': p[3],
    '--code-property': p[6], '--code-tag': p[1], '--code-important': r.accent,
    '--code-operator': g.fg, '--code-punctuation': r.muted,

    '--icon-color': r.muted, '--icon-color-hover': g.fg, '--icon-color-active': r.accent, '--icon-color-focused': g.fg,
    '--nav-item-color': r.muted, '--nav-item-color-hover': g.fg, '--nav-item-color-active': g.fg, '--nav-item-color-selected': g.fg,
    '--nav-item-background-hover': c.hover, '--nav-item-background-active': c.hover, '--nav-item-background-selected': c.hover,
    '--titlebar-background': c.sidebar, '--titlebar-background-focused': c.sidebar,
    '--titlebar-text-color': r.muted, '--titlebar-text-color-focused': g.fg,
    '--tab-text-color': r.muted, '--tab-text-color-focused': g.fg, '--tab-text-color-active': g.fg,
    '--tab-text-color-focused-active': g.fg, '--tab-text-color-focused-active-current': g.fg,
    '--status-bar-background': c.sidebar, '--status-bar-text-color': r.muted,
    '--graph-node': r.muted, '--graph-node-unresolved': c.border, '--graph-node-focused': r.accent,
    '--graph-node-tag': r.success, '--graph-node-attachment': r.warning, '--graph-line': c.border, '--graph-text': g.fg,
  };
}

const report = [];
for (const fam of FAMILIES) {
  const dir = path.join(vault, '.obsidian', 'themes', fam.label);
  fs.mkdirSync(dir, { recursive: true });
  const blocks = [];
  for (const mode of ['light', 'dark']) {
    const v = variables(fam, mode);
    blocks.push(`/* ${mode} */\nbody.theme-${mode} {\n${Object.entries(v).map(([k, val]) => `  ${k}: ${val};`).join('\n')}\n}`);
    // Every text color on every background it's used on.
    const texts = [v['--text-normal'], v['--text-muted'], v['--text-accent'], v['--text-error'], v['--text-warning'], v['--text-success'],
      v['--code-keyword'], v['--code-string'], v['--code-function'], v['--code-value'], v['--code-property'], v['--code-tag']];
    const backs = [v['--background-primary'], v['--background-primary-alt'], v['--background-secondary'], v['--background-modifier-hover'], v['--text-selection'], v['--tag-background']];
    const worst = Math.min(...texts.flatMap((t) => backs.map((b) => contrast(t, b))));
    const hl = contrast(v['--text-normal'], v['--text-highlight-bg']);
    const btn = contrast(v['--text-on-accent'], v['--interactive-accent']);
    report.push(`${fam.label.padEnd(9)} ${mode.padEnd(5)} text/code colors on page, cards, sidebar, hover, selection, tags >= ${worst.toFixed(2)}:1; text on highlight ${hl.toFixed(2)}:1; on accent buttons ${btn.toFixed(2)}:1`);
  }
  const header = `/* ${fam.label} for Obsidian. Generated by the Magnus repo:
 * terminal-theme/tools/build-obsidian.mjs (npm run themes:obsidian).
 * Do not edit by hand: change the terminal themes there and regenerate. */\n\n`;
  fs.writeFileSync(path.join(dir, 'theme.css'), header + blocks.join('\n\n') + '\n');
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ name: fam.label, version: '1.0.0', minAppVersion: '1.0.0', author: 'Magnus terminal themes', authorUrl: '' }, null, 2) + '\n'
  );
}
console.log(report.join('\n'));
console.log(`Wrote ${FAMILIES.length} themes to ${path.join(vault, '.obsidian', 'themes')}`);
