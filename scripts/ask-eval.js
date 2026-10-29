// Ask Magnus eval: realistic questions against the demo data, scored on the
// tools the model calls and the changes it proposes. Never touches real data.
//   MAGNUS_DEMO=1 node scripts/ask-eval.js            (local model)
//   MAGNUS_DEMO=1 node scripts/ask-eval.js --only 3,7 (some cases)
if (!process.env.MAGNUS_DEMO) {
  console.error('run with MAGNUS_DEMO=1 (the eval only ever uses demo data)');
  process.exit(1);
}
const { createToolbox } = await import('../src/lib/assistant/tools.js');
const { ask } = await import('../src/lib/assistant/loop.js');
const { ollamaModel, ensureOllama, unloadModel, stopOllama } = await import('../src/lib/assistant/models/ollama.js');
const { parseDateInput } = await import('../src/lib/dates.js');
const { todayISO, addDays } = await import('../src/lib/data/completions.js');

const today = todayISO();
const d = (word) => parseDateInput(word);
const has = (s, word) => String(s).toLowerCase().includes(word.toLowerCase());
const updates = (r) => r.proposals.filter((p) => p.kind === 'update_task');
const creates = (r) => r.proposals.filter((p) => p.kind === 'create_task');
const logs = (r) => r.proposals.filter((p) => p.kind === 'log');
const looked = (r, word) => r.trace.some((t) => has(t, word));
const updateOf = (r, title) => updates(r).find((p) => has(p.label, title));
const ok = (cond, why) => (cond ? true : why);

const CASES = [
  ["What's overdue?", (r) => ok(has(r.answer, 'passport') && !has(r.answer, 'onboarding') && !r.proposals.length, 'should name Renew passport (not the finished onboarding email), no changes')],
  ['What do I have due today?', (r) => ok(has(r.answer, 'faucet'), 'should name Fix leaky faucet')],
  ['Move the leaky faucet task to Friday', (r) => ok(updateOf(r, 'faucet')?.changes.due_date === d('fri') && r.proposals.length === 1, `faucet → ${d('fri')}`)],
  ['Add a task to call mom tomorrow', (r) => ok(creates(r).length === 1 && has(creates(r)[0].fields.title, 'mom') && creates(r)[0].fields.due_date === addDays(today, 1), 'one task, due tomorrow')],
  [
    'Add "submit expense report" due Monday, high priority, in the Work category',
    (r) => {
      const c = creates(r)[0];
      return ok(c && has(c.fields.title, 'expense') && c.fields.priority === 'high' && c.fields.due_date === d('mon') && c.fields.category_id, 'title, high, Monday, Work');
    },
  ],
  ['Log 7.5 hours of sleep', (r) => ok(logs(r).length === 1 && logs(r)[0].metric === 'sleep' && logs(r)[0].value === 7.5 && logs(r)[0].date === today, 'sleep 7.5 today')],
  ['I did a 30 minute run yesterday', (r) => ok(logs(r).length === 1 && logs(r)[0].metric === 'workout' && logs(r)[0].value === 30 && logs(r)[0].date === addDays(today, -1), 'workout 30 yesterday')],
  ['Mood 4 and energy 3 today', (r) => ok(logs(r).length === 2 && logs(r).some((l) => l.metric === 'mood' && l.value === 4) && logs(r).some((l) => l.metric === 'energy' && l.value === 3), 'mood 4 + energy 3')],
  ['Mark renew passport as done', (r) => ok(updateOf(r, 'passport')?.changes.status === 'done' && r.proposals.length === 1, 'passport → done')],
  [
    'Move everything that is overdue or due today to Saturday',
    (r) => ok(updates(r).length === 2 && updateOf(r, 'passport')?.changes.due_date === d('sat') && updateOf(r, 'faucet')?.changes.due_date === d('sat'), 'passport + faucet → Saturday'),
  ],
  [
    'Push everything due in the next week to Monday, except the planning doc',
    (r) => {
      const u = updates(r);
      const target = d('mon');
      return ok(!updateOf(r, 'planning') && u.length >= 1 && u.every((p) => p.changes.due_date === target), `others → ${target}, planning untouched`);
    },
  ],
  ["Which routines haven't I done today?", (r) => ok(has(r.answer, 'stretch') && !has(r.answer, 'meditate'), 'Stretch etc., not Meditate')],
  ['How has my sleep been this week?', (r) => ok(looked(r, 'log'), 'should read the Log')],
  ['What am I reading right now?', (r) => ok(has(r.answer, 'middlemarch'), 'Middlemarch')],
  ['How much did I focus in the last 7 days?', (r) => ok(looked(r, 'focus'), 'should read focus time')],
  ['What are my goals?', (r) => ok(has(r.answer, 'internship') && has(r.answer, 'marathon'), 'both goals')],
  ['Star the dentist appointment task', (r) => ok(!r.proposals.some((p) => p.changes?.is_starred), 'already 3 starred: no star proposal')],
  ['Make the Middlemarch essay high priority', (r) => ok(updateOf(r, 'middlemarch')?.changes.priority === 'high', 'Middlemarch → high')],
  ['Which projects are in progress?', (r) => ok(has(r.answer, 'kitchen') && !has(r.answer, 'personal site'), 'Kitchen renovation only')],
  [
    'Unstar the planning doc and star the dentist appointment instead',
    (r) => ok(updateOf(r, 'planning')?.changes.is_starred === false && updateOf(r, 'dentist')?.changes.is_starred === true, 'unstar planning, star dentist'),
  ],
];

const only = process.argv.includes('--only') ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(',').map(Number)) : null;
await ensureOllama();
const model = ollamaModel();
let pass = 0;
let ran = 0;
let totalMs = 0;
for (const [i, [q, check]] of CASES.entries()) {
  if (only && !only.has(i + 1)) continue;
  ran++;
  const toolbox = createToolbox();
  const trace = [];
  const t0 = Date.now();
  let r;
  try {
    const { answer, steps } = await ask({ question: q, model, toolbox, onTrace: (l) => trace.push(l) });
    r = { answer, steps, trace, proposals: [...toolbox.proposals] };
  } catch (err) {
    r = { answer: `ERROR ${err.message}`, steps: 0, trace, proposals: [] };
  }
  const ms = Date.now() - t0;
  totalMs += ms;
  const verdict = check(r);
  if (verdict === true) pass++;
  console.log(`${verdict === true ? 'PASS' : 'FAIL'} ${String(i + 1).padStart(2)} ${(ms / 1000).toFixed(1).padStart(5)}s ${r.steps} steps  ${q}`);
  if (verdict !== true) {
    console.log(`        want: ${verdict}`);
    console.log(`        looked at: ${r.trace.join(' · ') || '—'}`);
    console.log(`        proposed: ${r.proposals.map((p) => p.label).join(' | ') || '—'}`);
    console.log(`        answer: ${r.answer.replace(/\s+/g, ' ').slice(0, 220)}`);
  }
}
console.log(`\n${pass}/${ran} passed · ${(totalMs / 1000 / Math.max(1, ran)).toFixed(1)}s per question on ${model.label}`);
await unloadModel();
await stopOllama();
