// Asks the terminal what RGB values its theme assigns to ANSI palette slots
// (OSC 4 query — Ghostty, kitty, iTerm2, etc. all answer). This lets the
// home-screen gradient be built from *your* Ghostty theme's colors at runtime
// instead of a hardcoded preset. A DA1 query (`ESC [ c`) is sent last as a
// sentinel: every terminal answers it, and answers arrive in order, so we
// know we've heard everything without waiting out a long timeout.

export function queryPalette(indices, timeoutMs = 300) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve({});

  return new Promise((resolve) => {
    let buf = '';
    const wasRaw = stdin.isRaw;
    const finish = () => {
      clearTimeout(timer);
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(parsePaletteReplies(buf));
    };
    const onData = (chunk) => {
      buf += chunk.toString('latin1');
      if (/\x1b\[\?[\d;]*c/.test(buf)) finish();
    };
    const timer = setTimeout(finish, timeoutMs);

    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.resume();
    stdout.write(indices.map((i) => `\x1b]4;${i};?\x07`).join('') + '\x1b[c');
  });
}

export function parsePaletteReplies(buf) {
  const out = {};
  const re = /\x1b\]4;(\d+);rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/gi;
  let m;
  while ((m = re.exec(buf))) {
    const to8 = (h) =>
      Math.round((parseInt(h, 16) / (16 ** h.length - 1)) * 255)
        .toString(16)
        .padStart(2, '0');
    out[Number(m[1])] = `#${to8(m[2])}${to8(m[3])}${to8(m[4])}`;
  }
  return out;
}
