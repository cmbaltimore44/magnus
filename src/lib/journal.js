import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { cleanText } from './sanitize.js';
import { toISO } from './data/completions.js';
import { runCapture } from './shell.js';

// Turns the "Tags / links" answer (New Note, New Essay, book/film essays)
// into new-note / new-essay flags:
//   "idea work [[pricing ideas]]" → ['--tag', 'idea', '--tag', 'work', '--link', 'pricing ideas']
// A leading # on a tag is dropped, so "#book" works too.
export function tagLinkFlags(text) {
  const args = [];
  for (const m of String(text || '').matchAll(/\[\[([^\]]+)\]\]|(\S+)/g)) {
    if (m[1]) args.push('--link', m[1].trim());
    else if (m[2].replace(/^#/, '')) args.push('--tag', m[2].replace(/^#/, ''));
  }
  return args;
}

// "4 3 7.5" (mood, energy, hours slept; "-" skips one) → today's flags.
export function checkinFlags(text) {
  const parts = String(text || '').trim().split(/[\s,/]+/).filter(Boolean);
  if (parts.length > 3) throw new Error('Mood, energy, sleep: at most three numbers (e.g. 4 3 7.5)');
  const [mood, energy, sleep] = parts;
  const args = [];
  for (const [flag, v] of [['--mood', mood], ['--energy', energy]]) {
    if (v == null || v === '-') continue;
    if (!/^[1-5]$/.test(v)) throw new Error(`${flag.slice(2)} is 1–5 (got "${v}")`);
    args.push(flag, v);
  }
  if (sleep != null && sleep !== '-') {
    if (!/^\d{1,2}(\.\d+)?$/.test(sleep) || Number(sleep) > 24) throw new Error(`sleep is hours, e.g. 7.5 (got "${sleep}")`);
    args.push('--sleep', sleep);
  }
  return args;
}

export function todayEntryPath(date = new Date(), dir = journalDir()) {
  const iso = toISO(date);
  return path.join(dir, 'daily', iso.slice(0, 4), iso.slice(5, 7), `${iso}.md`);
}

// True when today's entry exists and its front matter already has a mood.
export function todayEntryHasCheckin(file = todayEntryPath()) {
  try {
    const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'));
    return Boolean(fm && /^mood:\s*\S/m.test(fm[1]));
  } catch {
    return false;
  }
}

export function journalDir() {
  return process.env.JOURNAL_DIR || path.join(os.homedir(), 'journal');
}

// Rows from `jlist --tsv`: type, date, title, tags, slug, path.
export function parseEntries(tsv) {
  return String(tsv || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [type, date, title, tags, slug, file] = line.split('\t').map((f) => cleanText(f || '', { keepNewlines: false }));
      return { type, date, title, tags: tags ? tags.split(',') : [], slug, path: file };
    })
    .filter((e) => e.path);
}

// Entries anywhere in the journal that link to [[slug]] (or [[slug|…]] / [[slug#…]]),
// same rule as jlist's delete prompt.
export function findBacklinks(slug, excludePath, dir = journalDir()) {
  const pattern = new RegExp(`\\[\\[${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\||#|\\]\\])`);
  const hits = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (ent.name === '.git') continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md') && p !== excludePath) {
        try {
          if (pattern.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(dir, p));
        } catch {
          // unreadable file — skip
        }
      }
    }
  };
  try {
    walk(dir);
  } catch {
    // no journal dir
  }
  return hits.sort();
}

// Move a file to the macOS Trash with the built-in `trash` command.
export function moveToTrash(file) {
  return new Promise((resolve, reject) => {
    execFile('trash', [file], (err, _stdout, stderr) => (err ? reject(new Error(String(stderr).trim() || err.message)) : resolve()));
  });
}

// ---------- captures from the phone ----------
// An iOS Shortcut appends "YYYY-MM-DD HH:MM:SS text" lines to this iCloud
// Drive file. Magnus never writes to it (so iCloud never sees two writers);
// capture-batch remembers which lines it has already added.
export function phoneQueuePath(home = os.homedir()) {
  return path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Magnus', 'inbox-queue.txt');
}

// Adds new phone captures to inbox.md. Returns how many were added (0 when
// there's no queue file yet); throws if capture-batch fails.
export async function importPhoneQueue(file = phoneQueuePath()) {
  let text;
  try {
    text = await fs.promises.readFile(file, 'utf8'); // downloads it first if iCloud evicted it
  } catch {
    return 0;
  }
  if (!text.trim()) return 0;
  const res = await runCapture('capture-batch', [], { input: text });
  if (!res.ok) throw new Error(res.stderr.trim() || 'capture-batch failed');
  return Number(/Captured (\d+)/.exec(res.stdout)?.[1] || 0);
}

// ---------- inbox.md (written by `capture`) ----------

export function inboxPath(dir = journalDir()) {
  return path.join(dir, 'inbox.md');
}

// Items are lines like "- [2026-09-23 17:46] some thought"; `line` is 1-based.
export function readInbox(file = inboxPath()) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').flatMap((raw, i) => {
    if (!raw.startsWith('- ')) return [];
    const m = /^- (?:\[([^\]]+)\] )?(.*)$/.exec(raw);
    return [{ line: i + 1, raw, when: m[1] || null, text: cleanText(m[2], { keepNewlines: false }) }];
  });
}

// Current line number of an item (the file may have changed since it was read).
export function findInboxLine(raw, file = inboxPath()) {
  const hit = readInbox(file).find((it) => it.raw === raw);
  return hit ? hit.line : null;
}

// Removes the first line exactly equal to `raw` (same rule as new-note).
// Returns the removed line's index so undo can put it back.
export function removeInboxLine(raw, file = inboxPath()) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const at = lines.indexOf(raw);
  if (at < 0) return -1;
  lines.splice(at, 1);
  writeAtomic(file, lines.join('\n'));
  return at;
}

export function restoreInboxLine(raw, at, file = inboxPath()) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.splice(Math.min(at, lines.length), 0, raw);
  writeAtomic(file, lines.join('\n'));
}

function writeAtomic(file, text) {
  const tmp = `${file}.magnus-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ---------- writing stats (from jlist rows) ----------

// Consecutive days with a daily entry, ending today — or yesterday, while
// today's entry isn't written yet (same grace rule as routine streaks).
export function writingStreak(entries, todayISO) {
  const days = new Set(entries.filter((e) => e.type === 'daily').map((e) => e.date));
  const back = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return toISO(d);
  };
  let cursor = days.has(todayISO) ? todayISO : back(todayISO);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = back(cursor);
  }
  return n;
}

export function entriesByDate(entries) {
  const counts = new Map();
  for (const e of entries) if (e.date) counts.set(e.date, (counts.get(e.date) || 0) + 1);
  return counts;
}

// ---------- tag suggestions (Tags / links prompts) ----------

// Tags listed in TAGS.md ("- tag" lines), in file order.
export function listedTags(dir = journalDir()) {
  try {
    return [...fs.readFileSync(path.join(dir, 'TAGS.md'), 'utf8').matchAll(/^- (\S.*)$/gm)].map((m) => m[1].trim());
  } catch {
    return [];
  }
}

// Candidates for the word being typed: TAGS.md tags plus tags in use,
// prefix matches first, most-used first. `counts` is tag → entries.
export function suggestTags(word, listed, counts, limit = 6) {
  const w = String(word || '').replace(/^#/, '').toLowerCase();
  const all = [...new Set([...listed, ...Object.keys(counts)])];
  const score = (t) => (t.startsWith(w) ? 0 : t.includes(w) ? 1 : 2);
  return all
    .filter((t) => score(t) < 2)
    .sort((a, b) => score(a) - score(b) || (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b))
    .slice(0, limit);
}
