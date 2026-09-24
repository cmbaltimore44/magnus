// Asks the terminal for its current background color (OSC 11 query — Ghostty,
// kitty, iTerm2, etc. all answer) so Magnus can pick Life Tracker's light or
// dark palette to match. A DA1 query (`ESC [ c`) is sent last as a sentinel:
// every terminal answers it and answers arrive in order, so we know we've
// heard everything without waiting out a long timeout.

export function queryBackgroundColor(timeoutMs = 300) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve(null);

  return new Promise((resolve) => {
    let buf = '';
    const wasRaw = stdin.isRaw;
    const finish = () => {
      clearTimeout(timer);
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(parseBackgroundReply(buf));
    };
    const onData = (chunk) => {
      buf += chunk.toString('latin1');
      if (/\x1b\[\?[\d;]*c/.test(buf)) finish();
    };
    const timer = setTimeout(finish, timeoutMs);

    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.resume();
    stdout.write('\x1b]11;?\x07\x1b[c');
  });
}

export function parseBackgroundReply(buf) {
  const m = /\x1b\]11;rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(buf);
  if (!m) return null;
  const to8 = (h) =>
    Math.round((parseInt(h, 16) / (16 ** h.length - 1)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to8(m[1])}${to8(m[2])}${to8(m[3])}`;
}
