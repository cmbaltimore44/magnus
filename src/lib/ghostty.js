import { getPref } from './prefs.js';
import { execFile, execFileSync } from 'node:child_process';
import os from 'node:os';
import { cleanText } from './sanitize.js';

// Opens a command in a new Ghostty tab through Ghostty's AppleScript
// dictionary (Ghostty 1.3+: `new tab ... with configuration {...}`), so the
// journal scripts get their own tab while Magnus keeps running in this one.
//
// The tab starts your normal shell and Magnus types ` exec <command>` into it
// (`initial input`) rather than using the configuration's `command`: in
// Ghostty 1.3.1, tabs created with `command` always end on "Process exited.
// Press any key to close the terminal", whatever `wait after command` says.
// With exec, the shell itself is gone when the script ends, so the tab closes
// like typing `exit`. The leading space keeps it out of shell history (with
// HIST_IGNORE_SPACE).
//
// Values travel as `on run argv` arguments rather than being spliced into
// the AppleScript source, so titles with quotes can't break the script.
const SCRIPT = `
on run argv
  set cmd to item 1 of argv
  set cwd to item 2 of argv
  set envList to {}
  repeat with i from 3 to count of argv
    set end of envList to item i of argv
  end repeat
  tell application "Ghostty"
    set cfg to {initial input:(" exec " & cmd & linefeed), initial working directory:cwd, environment variables:envList}
    if (count of windows) > 0 then
      new tab in front window with configuration cfg
    else
      new window with configuration cfg
    end if
  end tell
  return "ok"
end run`;

export function canOpenGhosttyTabs() {
  if (process.env.MAGNUS_JOURNAL_TABS === '0') return false;
  if (process.env.MAGNUS_JOURNAL_TABS !== '1' && getPref('journalTabs', true) === false) return false;
  return process.platform === 'darwin' && (process.env.TERM_PROGRAM || '').toLowerCase() === 'ghostty';
}

const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function resolveCommand(cmd) {
  if (cmd.includes('/')) return cmd;
  try {
    return execFileSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', cmd], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

// Ghostty starts new tabs with its own (launchd) environment, so pass along
// the PATH and journal settings Magnus is running with. The tab is held open
// only when the script fails within a few seconds (a real error, e.g. a bad
// title), never after an editing session: the scripts end with `fresh`, so
// they pass along whatever exit code the editor returns on quit.
export function openInGhosttyTab(cmd, args = []) {
  const resolved = resolveCommand(cmd);
  if (!resolved) return Promise.reject(new Error(`${cmd}: command not found`));

  // The command line is typed into an interactive shell, so arguments must not
  // carry control characters (or newlines) that the shell would act on.
  const safeArgs = args.map((a) => cleanText(String(a), { keepNewlines: false }));
  const inner = [
    'started=$SECONDS',
    [resolved, ...safeArgs].map(shq).join(' '),
    's=$?',
    'if [ $s -ne 0 ] && [ $((SECONDS - started)) -lt 3 ]; then echo; read -rsn1 -p "[exited with status $s — press any key to close this tab]"; fi',
  ].join('; ');
  const command = `/bin/bash -c ${shq(inner)}`;

  const env = ['PATH', 'JOURNAL_DIR', 'JOURNAL_EDITOR', 'NVIM_APPNAME', 'EDITOR', 'VISUAL', 'LANG']
    .filter((k) => process.env[k])
    .map((k) => `${k}=${process.env[k]}`);

  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', SCRIPT, command, os.homedir(), ...env], { timeout: 10000 }, (error, stdout, stderr) => {
      if (error || !String(stdout).includes('ok')) reject(new Error(String(stderr).trim() || error?.message || 'osascript failed'));
      else resolve();
    });
  });
}
