import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Small local UI-preference file (the web app keeps the same kind of thing in
// localStorage) — e.g. which Library groups are collapsed. Never user data.
const DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magnus');
const FILE = path.join(DIR, 'prefs.json');

let cache = null;

function load() {
  if (cache) return cache;
  if (process.env.MAGNUS_DEMO) return (cache = {});
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

export function getPref(key, fallback) {
  const prefs = load();
  return key in prefs ? prefs[key] : fallback;
}

export function setPref(key, value) {
  const prefs = load();
  prefs[key] = value;
  if (process.env.MAGNUS_DEMO) return; // demo mode never touches real files
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(prefs, null, 2));
  } catch {
    // Preferences are best-effort.
  }
}
