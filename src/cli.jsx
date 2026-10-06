import { render } from 'ink';
import App from './ui/App.jsx';
import { queryPalette } from './lib/palette.js';
import { GRADIENT_SLOTS } from './lib/theme.js';
import { signOut } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { ALT_SCREEN_HOME } from './lib/shell.js';
import { runSubcommand, SUBCOMMANDS } from './subcommands.js';

const HELP = `magnus — terminal companion to Life Tracker

Usage:
  magnus            launch the full-screen interface
  magnus --logout   sign out and remove the session from the macOS Keychain
  magnus --help     show this help

Journal plumbing (used by the ~/bin scripts; print Markdown or nothing):
  magnus context [--date YYYY-MM-DD]   today's plan: starred/due tasks, routines, a quote
  magnus context --week YYYY-Www       one week of Life Tracker data (for jweek)
  magnus context --close [--date D]    end of day: finished tasks, routines, carry-overs, prompts
  magnus log [--date D] [--mood 1-5] [--energy 1-5] [--sleep H] [--weight N]
             [--workout MIN [--type T]]   write to the Log

Focus timer (shared with the TUI and Magnus Tutor; magnus timer --help):
  magnus timer status|start|pause|resume|skip|add5|switch|stop|discard [--json]

Magnus Tutor (magnus tutor --help):
  magnus tutor [ask "question" [--course SLUG] | stop]

Environment:
  MAGNUS_DEMO=1     run against in-memory sample data (no sign-in, nothing saved)
  MAGNUS_KITTY=0|1  force kitty-graphics cover images off/on
  MAGNUS_JOURNAL_TABS=0  start journal entries in this terminal instead of a new Ghostty tab
  MAGNUS_STILL=1    hold Home's heron still (no animation)
  MAGNUS_APPEARANCE=light|dark  override the macOS light/dark setting
  VISUAL / EDITOR   editor for long notes (ctrl+e in a form); defaults to fresh
`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (SUBCOMMANDS.includes(args[0])) {
  process.exit(await runSubcommand(args[0], args.slice(1)));
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
// terminal for the RGB of the active theme family's two signature slots
// (e.g. lilac → rose, gold → coral → rose, terracotta → amber) so it matches
// the real theme.
const palette = await queryPalette(GRADIENT_SLOTS);
const gradient = GRADIENT_SLOTS.map((slot) => palette[slot]).filter(Boolean);

// Start from a cleared, homed alternate screen (see ALT_SCREEN_HOME).
process.stdout.write(ALT_SCREEN_HOME);

const instance = render(<App gradient={gradient.length === GRADIENT_SLOTS.length ? gradient : null} />, {
  alternateScreen: true,
  exitOnCtrlC: true,
});

try {
  await instance.waitUntilExit();
} finally {
  supabase.auth.stopAutoRefresh?.();
}
process.exit(0);
