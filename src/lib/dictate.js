import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handOff } from './shell.js';

// Voice input through ~/bin/dictate (local Whisper). The script owns the
// terminal while recording (Enter stops, Esc cancels) and prints the text on
// stdout. It keeps each clip in $DICTATE_DIR/corpus as ID.wav + ID.raw.txt;
// saving a form adds ID.txt, the text as finally saved, so the clips build up
// a training set for fine-tuning Whisper on this voice later.

export function dictateDir(env = process.env) {
  return env.DICTATE_DIR || path.join(os.homedir(), '.local', 'share', 'dictate');
}

// Returns { text, clipId } or null (cancelled, nothing heard, or no script).
export async function dictate(suspendTerminal, prompt = '') {
  let result;
  await handOff(suspendTerminal, async () => {
    const args = ['--commands', ...(prompt ? ['--prompt', prompt] : [])];
    result = spawnSync('dictate', args, { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' });
    if (result.error) {
      fs.writeSync(1, `\ndictate: ${result.error.message}\n\x1b[2m[press any key to return to Magnus]\x1b[22m`);
      spawnSync('bash', ['-c', 'read -rsn1'], { stdio: 'inherit' });
    }
  });
  if (result.error || result.status !== 0) return null;
  const text = String(result.stdout || '').trim();
  if (!text) return null;
  let clipId = null;
  try {
    clipId = fs.readFileSync(path.join(dictateDir(), 'corpus', 'last'), 'utf8').trim() || null;
  } catch {
    // no corpus: keep the text, skip the training pair
  }
  return { text, clipId };
}

// Pairs a clip with the text that was finally saved for it.
export function saveCorpusText(clipId, text) {
  if (!clipId || !/^[\w-]+$/.test(clipId)) return;
  const dir = path.join(dictateDir(), 'corpus');
  if (!fs.existsSync(path.join(dir, `${clipId}.wav`))) return;
  fs.writeFileSync(path.join(dir, `${clipId}.txt`), `${text}\n`);
}

// Whisper's --prompt steers spelling and style: the book's title and author,
// then earlier quotes from it (names, coined words, the author's punctuation).
// Whisper only reads the last ~220 tokens of a prompt, so keep it short.
const PROMPT_CHARS = 800;
export function quotePrompt(book, quotes = []) {
  const parts = [];
  if (book) parts.push(`${book.title}${book.author ? ` by ${book.author}` : ''}.`);
  let used = parts.join(' ').length;
  for (const q of quotes) {
    const text = String(q.quote_text || '').replace(/\s+/g, ' ').trim();
    if (!text || used + text.length + 1 > PROMPT_CHARS) continue;
    parts.push(text);
    used += text.length + 1;
  }
  return parts.join(' ');
}
