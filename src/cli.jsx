import { render } from 'ink';
import App from './ui/App.jsx';
import fs from 'node:fs';
import { queryBackgroundColor } from './lib/termcolors.js';
import { setThemeMode, modeForBackground, terminalColorsOn, TERMINAL_COLORS_RESET } from './lib/theme.js';
import { signOut } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { ALT_SCREEN_HOME } from './lib/shell.js';

const HELP = `magnus — terminal companion to Life Tracker

Usage:
  magnus            launch the full-screen interface
  magnus --logout   sign out and remove the session from the macOS Keychain
  magnus --help     show this help

Environment:
  MAGNUS_DEMO=1     run against in-memory sample data (no sign-in, nothing saved)
  MAGNUS_THEME=light|dark  force Life Tracker's light or dark palette (default: match terminal)
  MAGNUS_KITTY=0|1  force kitty-graphics cover images off/on
  MAGNUS_JOURNAL_TABS=0  start journal entries in this terminal instead of a new Ghostty tab
  VISUAL / EDITOR   editor for long notes (ctrl+e in a form); defaults to fresh
`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (args.includes('--logout')) {
  await signOut();
  process.stdout.write('Signed out. Keychain item "magnus-session" removed.\n');
  process.exit(0);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stderr.write('magnus needs an interactive terminal.\n');
  process.exit(1);
}

// Life Tracker's light or dark palette: forced via MAGNUS_THEME, otherwise
// matched to the terminal's current background (dark if it doesn't answer).
const forced = process.env.MAGNUS_THEME;
const mode = forced === 'light' || forced === 'dark' ? forced : modeForBackground(await queryBackgroundColor()) || 'dark';
setThemeMode(mode);

// Paint the terminal's default colors with the palette (restored on exit and
// while child programs run), then start from a cleared, homed alternate screen.
process.on('exit', () => fs.writeSync(1, TERMINAL_COLORS_RESET));
process.stdout.write(terminalColorsOn() + ALT_SCREEN_HOME);

const instance = render(<App />, {
  alternateScreen: true,
  exitOnCtrlC: true,
});

try {
  await instance.waitUntilExit();
} finally {
  supabase.auth.stopAutoRefresh?.();
}
process.exit(0);
