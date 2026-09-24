#!/usr/bin/env node
// Switch the whole terminal setup between theme families:
//   Ghostty  – rewrites the `theme = light:…,dark:…` line and reloads open windows
//   Fresh    – ~/.config/fresh/init.ts reads the family on launch (config.json
//              "theme" is updated too, as the fallback)
//   Magnus   – reads the family on launch to pick its accent color slot
//   bat      – uses the terminal's ANSI colors, so it follows automatically
//
//   magnus-theme                 show the current family and the options
//   magnus-theme <family>        switch (heather | lakeglow | beacon | hearth)
//   magnus-theme install         copy this repo's theme files into ~/.config
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
const REPO_THEMES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'terminal-theme');
const STATE_FILE = path.join(HOME, '.config', 'magnus', 'terminal-theme');
const GHOSTTY_THEMES = path.join(HOME, '.config', 'ghostty', 'themes');
const FRESH_DIR = path.join(HOME, '.config', 'fresh');
const GHOSTTY_CONFIGS = [
  path.join(HOME, 'Library', 'Application Support', 'com.mitchellh.ghostty', 'config'),
  path.join(HOME, '.config', 'ghostty', 'config'),
];

export const FAMILIES = {
  heather: { label: 'Heather', light: 'Heather Light', dark: 'Heather Dark' },
  lakeglow: { label: 'Lakeglow', light: 'Lakeglow Light', dark: 'Lakeglow Dark' },
  beacon: { label: 'Beacon', light: 'Beacon Light', dark: 'Beacon Dark' },
  hearth: { label: 'Hearth', light: 'Hearth Light', dark: 'Hearth Dark' },
};

function current() {
  try {
    return fs.readFileSync(STATE_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function ghosttyConfigPath() {
  return GHOSTTY_CONFIGS.find((p) => fs.existsSync(p)) || GHOSTTY_CONFIGS[0];
}

function install() {
  const copy = (from, to) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.log(`  ${to.replace(HOME, '~')}`);
  };
  console.log('Installing theme files:');
  for (const family of Object.keys(FAMILIES)) {
    const dir = path.join(REPO_THEMES, family);
    for (const f of fs.readdirSync(path.join(dir, 'ghostty'))) copy(path.join(dir, 'ghostty', f), path.join(GHOSTTY_THEMES, f));
    for (const f of fs.readdirSync(path.join(dir, 'fresh'))) copy(path.join(dir, 'fresh', f), path.join(FRESH_DIR, 'themes', f));
  }
  copy(path.join(REPO_THEMES, 'fresh', 'init.ts'), path.join(FRESH_DIR, 'init.ts'));
  copy(path.join(REPO_THEMES, 'bat', 'config'), path.join(HOME, '.config', 'bat', 'config'));
}

function switchTo(family) {
  const f = FAMILIES[family];
  for (const name of [f.light, f.dark]) {
    if (!fs.existsSync(path.join(GHOSTTY_THEMES, name))) {
      throw new Error(`Ghostty theme "${name}" isn't installed — run: magnus-theme install`);
    }
  }

  // 1. state file read by Fresh's init.ts and by Magnus
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, family + '\n');

  // 2. Ghostty: replace (or add) the theme line
  const cfgPath = ghosttyConfigPath();
  const line = `theme = light:${f.light},dark:${f.dark}`;
  let cfg = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : '';
  cfg = /^theme\s*=.*$/m.test(cfg) ? cfg.replace(/^theme\s*=.*$/m, line) : cfg.replace(/\n?$/, `\n${line}\n`);
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, cfg);

  // 3. Fresh: fallback theme in config.json (init.ts normally picks light/dark)
  const freshCfg = path.join(FRESH_DIR, 'config.json');
  try {
    const json = fs.existsSync(freshCfg) ? JSON.parse(fs.readFileSync(freshCfg, 'utf8')) : {};
    json.theme = `${family}-dark`;
    fs.writeFileSync(freshCfg, JSON.stringify(json, null, 2) + '\n');
  } catch (err) {
    console.warn(`  (left ${freshCfg.replace(HOME, '~')} alone: ${err.message})`);
  }

  // 4. Reload open Ghostty windows (harmless if Ghostty isn't running)
  let reloaded = false;
  try {
    execFileSync(
      'osascript',
      ['-e', 'tell application "Ghostty" to perform action "reload_config" on focused terminal of selected tab of front window'],
      { stdio: 'ignore', timeout: 5000 }
    );
    reloaded = true;
  } catch {
    // Ghostty not running / no windows
  }

  console.log(`Switched to ${f.label}.`);
  console.log(`  Ghostty: ${reloaded ? 'reloaded' : 'applies next time Ghostty opens'} (${cfgPath.replace(HOME, '~')})`);
  console.log('  Fresh and Magnus: pick it up the next time they start.');
}

const arg = process.argv[2];
try {
  if (!arg) {
    const cur = current() || 'hearth';
    console.log(`Current: ${cur}${current() ? '' : ' (default)'}`);
    for (const [key, f] of Object.entries(FAMILIES)) console.log(`  ${key === cur ? '*' : ' '} ${key.padEnd(14)} ${f.label}`);
    console.log('\nUsage: magnus-theme <family> | magnus-theme install');
  } else if (arg === 'install') {
    install();
  } else if (FAMILIES[arg]) {
    switchTo(arg);
  } else {
    console.error(`Unknown theme "${arg}". Options: ${Object.keys(FAMILIES).join(', ')}`);
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
