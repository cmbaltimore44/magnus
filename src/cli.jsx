import { render } from 'ink';
import App from './ui/App.jsx';
import { queryPalette } from './lib/palette.js';
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

// Colors come from the terminal theme. For the banner gradient, ask the
// terminal what RGB its theme uses for bright red (Life Tracker terracotta)
// and yellow (amber), so the gradient matches whatever theme is active.
const palette = await queryPalette([9, 3]);
const gradient = [palette[9], palette[3]].filter(Boolean);

// Start from a cleared, homed alternate screen (see ALT_SCREEN_HOME).
process.stdout.write(ALT_SCREEN_HOME);

const instance = render(<App gradient={gradient.length === 2 ? gradient : null} />, {
  alternateScreen: true,
  exitOnCtrlC: true,
});

try {
  await instance.waitUntilExit();
} finally {
  supabase.auth.stopAutoRefresh?.();
}
process.exit(0);
