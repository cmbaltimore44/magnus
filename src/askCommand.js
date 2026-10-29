// `magnus ask "…"`: Ask Magnus from a shell. The answer prints when it's
// ready (the lookups it made print as they happen). Proposed changes are
// listed and applied only after a y at the prompt, or with --yes.
import readline from 'node:readline/promises';
import { createAssistant } from './lib/assistant/index.js';
import { cleanText } from './lib/sanitize.js';
import { PLAN_STEPS, savePlan } from './lib/assistant/plan.js';
import { listTasks } from './lib/data/tasks.js';

// --yes skips the review, so it only covers small batches that don't finish
// tasks (finishing one can't be undone from a shell, and spawns repeats).
export const YES_LIMIT = 5;

export function yesRefusal(proposals) {
  if (proposals.length > YES_LIMIT) return `--yes applies at most ${YES_LIMIT} changes; this is ${proposals.length}`;
  if (proposals.some((p) => p.kind === 'update_task' && p.changes.status === 'done')) return '--yes never marks tasks done';
  return null;
}

export const ASK_HELP = `magnus ask — ask Magnus about your tasks, routines, Log, focus time and library

  magnus ask "what's overdue?"
  magnus ask "move the faucet task to friday"     proposes the change, then asks y/N
  --claude   ask Claude instead of the local model (needs an API key: Settings in magnus)
  --yes      apply proposed changes without asking (at most ${YES_LIMIT}, and never marking a task done)
  --json     print { answer, proposals, applied } as JSON
`;

export const PLAN_HELP = `magnus plan — plan the week with Ask Magnus

  magnus plan   drafts due dates for the week's tasks (Friday to Sunday: next
                week; otherwise the rest of this one) and three stars, asks
                y/N, then saves the plan with this week's review
                (jweek --plan; it waits there until the review is written)
`;

// `magnus plan`: the "Plan my week" preset, from a shell.
export async function runPlan(args, { userId }) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(PLAN_HELP);
    return 0;
  }
  if (args.length) throw new Error(`magnus plan takes no options (see magnus plan --help)`);
  return converse({ userId, preset: 'week', flags: { claude: false, yes: false, json: false } });
}

export async function runAsk(args, { userId }) {
  const flags = { claude: false, yes: false, json: false };
  const words = [];
  for (const a of args) {
    if (a === '--help' || a === '-h') {
      process.stdout.write(ASK_HELP);
      return 0;
    }
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (!(name in flags)) throw new Error(`unknown option ${a} (see magnus ask --help)`);
      flags[name] = true;
    } else words.push(a);
  }
  const question = words.join(' ').trim();
  if (!question) throw new Error('magnus ask "your question"');
  return converse({ userId, question, flags });
}

async function converse({ userId, question, preset, flags }) {
  const assistant = createAssistant();
  const provider = flags.claude ? 'claude' : 'local';
  const say = (s) => !flags.json && process.stderr.write(s);
  try {
    if (provider === 'local') {
      const ready = await assistant.prepareLocal();
      if (!ready.ok) throw new Error(`not loading the local model: ${ready.reason} (try --claude)`);
    }
    const plan = preset ? await assistant.preset(preset) : null;
    if (plan) say(`${plan.label}…\n`);
    const { answer } = await assistant.ask(plan ? plan.text : question, {
      provider,
      maxSteps: plan ? PLAN_STEPS : undefined,
      planning: Boolean(plan?.win),
      onTrace: (line) => say(`· looked at ${line}\n`),
    });
    // Model text is untrusted: strip terminal control sequences before printing.
    const text = cleanText(answer, { keepNewlines: true });
    const proposals = assistant.proposals;
    let applied = false;
    let error = null;
    let refused = null;
    if (proposals.length) {
      if (!flags.json) {
        process.stdout.write(`${text}\n\nProposed:\n${proposals.map((p, i) => `  ${i + 1}. ${cleanText(p.label, { keepNewlines: false })}`).join('\n')}\n`);
      }
      const refusal = flags.yes ? yesRefusal(proposals) : null;
      refused = refusal;
      if (refusal) say(`${refusal}: review them instead (run without --yes in a terminal, or in Magnus's Ask).\n`);
      let go = flags.yes && !refusal;
      if (!go && !refusal && !flags.json && process.stdin.isTTY) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        go = /^y(es)?$/i.test((await rl.question(`Apply ${proposals.length === 1 ? 'it' : `these ${proposals.length}`}? [y/N] `)).trim());
        rl.close();
      }
      if (go) {
        const res = await assistant.apply(userId, proposals);
        applied = res.applied > 0;
        error = res.error;
        say(error ? `Applied ${res.applied} of ${proposals.length}: ${cleanText(error.message, { keepNewlines: false })}\n` : `Applied ${res.applied}.\n`);
        if (plan?.win && applied && !error) say(`${cleanText((await savePlan(plan.win, await listTasks())).message, { keepNewlines: false })}\n`);
      } else say(flags.json || process.stdin.isTTY ? 'Nothing changed.\n' : 'Nothing changed (run with --yes to apply).\n');
    } else if (!flags.json) process.stdout.write(`${text}\n`);
    if (flags.json) {
      process.stdout.write(`${JSON.stringify({ answer: text, proposals: proposals.map((p) => p.label), applied, ...(error ? { error: error.message } : {}), ...(refused ? { refused } : {}) })}\n`);
    }
    return error ? 1 : 0;
  } finally {
    await assistant.close();
  }
}
