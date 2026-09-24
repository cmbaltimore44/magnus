// Category colors are stored in Supabase as hex (the web app's color picker).
// Magnus never *renders* hex: each stored color is classified by hue into the
// nearest named ANSI slot, so categories follow your terminal theme too.

export function hexToAnsi(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 'white';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (s < 0.15 || d < 0.08) return l > 0.75 ? 'white' : 'gray';

  let h;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;

  if (h < 8 || h >= 345) return 'red';
  if (h < 25) return 'redBright'; // orange-reds
  if (h < 65) return 'yellow';
  if (h < 165) return 'green';
  if (h < 200) return 'cyan';
  if (h < 250) return 'blue';
  if (h < 300) return 'magenta';
  return 'magentaBright'; // pinks
}

// When Magnus *creates* a category it still has to write a hex value, because
// that's what the web app's `categories.color` column and UI expect. These are
// the web app's own swatch values (js/views/board.js COLORS), used purely as
// stored data — each maps back to the listed ANSI slot for display here.
export const CATEGORY_SWATCHES = [
  { ansi: 'redBright', hex: '#bf5433', label: 'orange' },
  { ansi: 'red', hex: '#c9463f', label: 'red' },
  { ansi: 'yellow', hex: '#b8791a', label: 'amber' },
  { ansi: 'green', hex: '#2fa84f', label: 'green' },
  { ansi: 'magenta', hex: '#8a4fd9', label: 'purple' },
  { ansi: 'magentaBright', hex: '#d94f9e', label: 'pink' },
  { ansi: 'cyan', hex: '#1fb6b6', label: 'teal' },
  { ansi: 'gray', hex: '#6b6b70', label: 'gray' },
];
