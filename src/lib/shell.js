import { spawnSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// All interactive hand-offs go through Ink's suspendTerminal(): it turns raw
// mode off, leaves the alternate screen, stops Ink reading stdin, and on
// resume re-applies everything and repaints from scratch. spawnSync then
// blocks Node's event loop for the child's lifetime, so nothing in Magnus can
// race the child for keystrokes.

// Ink re-enters the alternate screen on resume but draws a full-height frame
// from wherever the cursor happens to be, so if a child left the cursor
// mid-screen the top of Magnus scrolls away. Re-entering the alternate screen
// ourselves and homing the cursor first makes the repaint land at row 1.
export const ALT_SCREEN_HOME = '\x1b[?1049h\x1b[2J\x1b[H';

// With raw mode off, ctrl+c / ctrl+\ in the child (e.g. cancelling fzf)
// signal the whole foreground process group — Magnus included. Like git
// around $EDITOR, ignore them while the child owns the terminal. The listener
// outlives spawnSync briefly because the signal is only dispatched to JS once
// the event loop runs again.
function ignoreTerminalSignals() {
  const noop = () => {};
  const signals = ['SIGINT', 'SIGQUIT'];
  signals.forEach((sig) => process.on(sig, noop));
  return () => setTimeout(() => signals.forEach((sig) => process.off(sig, noop)), 250);
}

// Wraps Ink's suspendTerminal so every hand-off ignores terminal signals and
// returns to a clean, homed screen.
export function handOff(suspendTerminal, callback) {
  return suspendTerminal(async () => {
    const restoreSignals = ignoreTerminalSignals();
    try {
      return await callback();
    } finally {
      fs.writeSync(1, ALT_SCREEN_HOME);
      restoreSignals();
    }
  });
}

function waitForKey(message = '[press any key to return to Magnus]') {
  fs.writeSync(1, `\n\x1b[2m${message}\x1b[22m`);
  spawnSync('bash', ['-c', 'read -rsn1'], { stdio: 'inherit' });
}

// pause: true | false | 'auto'. 'auto' holds the screen when the child exits
// quickly or fails — e.g. `jsearch` printing "No matches found." and exiting
// — so its output isn't wiped by Magnus's repaint, while a normal editor
// session returns straight to Magnus.
export async function runInteractive(suspendTerminal, cmd, args = [], { pause = 'auto' } = {}) {
  let result;
  await handOff(suspendTerminal, async () => {
    const started = Date.now();
    result = spawnSync(cmd, args, { stdio: 'inherit' });
    const failed = Boolean(result.error) || result.status !== 0;
    if (result.error) fs.writeSync(1, `\n${cmd}: ${result.error.message}\n`);
    // 'auto': after a failure or a run too quick to read; 'failed': only after a failure.
    if (pause === true || (pause === 'failed' && failed) || (pause === 'auto' && (failed || Date.now() - started < 1500))) waitForKey();
  });
  return result;
}

// Non-interactive commands (jtags, jgraph, capture): capture output instead.
// `input`, if given, is written to the command's stdin.
export function runCapture(cmd, args = [], { input } = {}) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? (error.code ?? 1) : 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || '') || (error && error.code === 'ENOENT' ? `${cmd}: command not found` : ''),
      });
    });
    if (input != null) {
      child.stdin.on('error', () => {}); // the command may exit (or not exist) before reading it all
      child.stdin.end(input);
    }
  });
}

export function editorCommand() {
  return process.env.VISUAL || process.env.EDITOR || 'fresh';
}

// Opens `initial` in $VISUAL/$EDITOR (falling back to Fresh) and returns the
// edited text, or null if the editor couldn't be launched.
export async function editText(suspendTerminal, initial = '') {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-')), 'notes.md');
  fs.writeFileSync(file, initial || '');
  try {
    const result = await runInteractive(
      suspendTerminal,
      '/bin/sh',
      ['-c', `${editorCommand()} "$1"`, 'magnus-editor', file],
      { pause: false }
    );
    if (result.error || result.status !== 0) return null;
    return fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}
