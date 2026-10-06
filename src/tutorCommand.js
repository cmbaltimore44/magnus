// `magnus tutor`: start Magnus Tutor (if needed) and open it, ask from the
// terminal, or stop it. The tutor itself lives in the magnus-tutor repo.
import { spawnSync } from 'node:child_process';
import * as tutor from './lib/tutor.js';
import { cleanText } from './lib/sanitize.js';

export const TUTOR_HELP = `magnus tutor — Magnus Tutor (local study tutor)

  magnus tutor                       start it if needed and open the web app
  magnus tutor ask "question" [--course SLUG]   answer in the terminal (streams)
  magnus tutor stop                  stop the tutor and unload its models
`;

export async function runTutor(args) {
  const [cmd, ...rest] = args;
  if (cmd === '--help' || cmd === 'help') {
    process.stdout.write(TUTOR_HELP);
    return 0;
  }
  if (cmd === 'stop') {
    const r = spawnSync(tutor.tutorCommand(), ['stop'], { stdio: 'inherit' });
    return r.status ?? 1;
  }
  await tutor.ensureTutor();
  if (!cmd || cmd === 'open') {
    await tutor.openWeb(rest[0] || '/');
    process.stdout.write(`Magnus Tutor: ${tutor.tutorUrl()}\n`);
    return 0;
  }
  if (cmd === 'ask') {
    let course = null;
    const words = [];
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--course') course = rest[++i];
      else words.push(rest[i]);
    }
    const q = words.join(' ').trim();
    if (!q) throw new Error('magnus tutor ask "your question"');
    // Model text is untrusted: strip terminal control sequences (OSC 52 clipboard writes, OSC 8 links, …).
    const sid = await tutor.ask(q, { course, onText: (t) => process.stdout.write(cleanText(t, { keepNewlines: true })) });
    process.stdout.write(`\n(open in the web app: ${tutor.tutorUrl()}/session/${sid})\n`);
    return 0;
  }
  throw new Error(`unknown tutor command "${cmd}" (see magnus tutor --help)`);
}
