import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { cleanText } from './sanitize.js';

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
