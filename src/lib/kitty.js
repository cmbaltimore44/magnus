import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handOff } from './shell.js';
import { cleanText } from './sanitize.js';

// Book covers via the kitty graphics protocol (supported by Ghostty).
// Ink repaints would clobber an inline image, so covers are shown full-screen
// while Ink is suspended, then Magnus repaints when you press a key.

export function supportsKittyGraphics() {
  if (process.env.MAGNUS_KITTY === '1') return true;
  if (process.env.MAGNUS_KITTY === '0') return false;
  const term = `${process.env.TERM || ''} ${process.env.TERM_PROGRAM || ''}`.toLowerCase();
  return term.includes('ghostty') || term.includes('kitty') || term.includes('wezterm');
}

// Download (or decode a data: URL) and normalize to PNG with macOS's built-in
// `sips`, since the protocol's direct-transmission format is PNG.
const MAX_COVER_BYTES = 25 * 1024 * 1024;

export async function loadCoverPng(url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-cover-'));
  try {
    let bytes;
    const dataMatch = /^data:[^;,]+;base64,(.*)$/s.exec(url);
    if (dataMatch) {
      bytes = Buffer.from(dataMatch[1], 'base64');
    } else {
      if (!/^https?:\/\//i.test(url)) throw new Error('Cover URL must be http(s) or a data: URL');
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Cover download failed (HTTP ${res.status})`);
      if (Number(res.headers.get('content-length')) > MAX_COVER_BYTES) throw new Error('Cover image is too large');
      bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_COVER_BYTES) throw new Error('Cover image is too large');
    }
    const src = path.join(dir, 'cover-src');
    const out = path.join(dir, 'cover.png');
    fs.writeFileSync(src, bytes);
    execFileSync('sips', ['-s', 'format', 'png', '-Z', '1200', src, '--out', out], { stdio: 'ignore' });
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeKittyImage(png, { rows }) {
  const data = png.toString('base64');
  const CHUNK = 4096;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    const more = i + CHUNK < data.length ? 1 : 0;
    const control = i === 0 ? `a=T,f=100,q=2,r=${rows},m=${more}` : `m=${more}`;
    fs.writeSync(1, `\x1b_G${control};${chunk}\x1b\\`);
  }
}

export async function showCoverFullscreen(suspendTerminal, png, caption) {
  await handOff(suspendTerminal, async () => {
    const rows = process.stdout.rows || 24;
    fs.writeSync(1, '\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
    fs.writeSync(1, '\x1b[2;3H');
    writeKittyImage(png, { rows: Math.max(4, rows - 4) });
    fs.writeSync(1, `\x1b[${rows};3H\x1b[1m${cleanText(caption, { keepNewlines: false })}\x1b[22m  \x1b[2m· press any key\x1b[22m`);
    spawnSync('bash', ['-c', 'read -rsn1'], { stdio: 'inherit' });
    fs.writeSync(1, '\x1b_Ga=d,d=A\x1b\\');
  });
}
