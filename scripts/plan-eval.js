// Planning eval: "Plan my week" (mid-week and on a Friday) and "Pick my
// three" against the demo data, run a few times each, scored on the plan's
// shape. Never touches real data.
//   MAGNUS_DEMO=1 node scripts/plan-eval.js [runs] [case name part, e.g. friday]
if (!process.env.MAGNUS_DEMO) {
  console.error('run with MAGNUS_DEMO=1 (the eval only ever uses demo data)');
  process.exit(1);
}
const { createToolbox } = await import('../src/lib/assistant/tools.js');
const { ask } = await import('../src/lib/assistant/loop.js');
const { weekQuestion, threeQuestion, PLAN_STEPS } = await import('../src/lib/assistant/plan.js');
const { ollamaModel, ensureOllama, unloadModel, stopOllama } = await import('../src/lib/assistant/models/ollama.js');
const tasksApi = await import('../src/lib/data/tasks.js');
const { todayISO, addDays } = await import('../src/lib/data/completions.js');

const runs = Number(process.argv[2] || 3);
const only = process.argv[3] || null; // e.g. "friday" to run just the cases whose name contains it
const today = todayISO();
const friday = addDays(today, (5 - new Date(today + 'T00:00:00').getDay() + 7) % 7);

// The task list as it would be after the proposals.
async function after(proposals) {
  const tasks = (await tasksApi.listTasks()).map((t) => ({ ...t }));
  for (const p of proposals) {
    if (p.kind === 'update_task') Object.assign(tasks.find((t) => t.id === p.id), p.changes);
    if (p.kind === 'create_task') tasks.push({ ...p.fields, status: 'todo' });
  }
  return tasks.filter((t) => t.status !== 'done');
}

function scoreWeek(win, before, proposals, tasks) {
  const problems = [];
  const moved = proposals.filter((p) => p.kind === 'update_task' && 'due_date' in p.changes);
  for (const p of moved) if (!p.changes.due_date || p.changes.due_date < win.start) problems.push(`dated before the window: ${p.label}`);
  for (const d of win.days) {
    const n = tasks.filter((t) => t.due_date === d).length;
    if (n > 4) problems.push(`${n} tasks on ${d}`);
  }
  const passport = tasks.find((t) => t.title === 'Renew passport');
  if (!passport.due_date || passport.due_date < win.start || passport.due_date > win.end) problems.push(`overdue passport not scheduled in the window (${passport.due_date})`);
  if (moved.some((p) => before.find((t) => t.id === p.id)?.repeat)) problems.push('moved a repeating task');
  const starred = tasks.filter((t) => t.is_starred).length;
  if (starred > 3) problems.push(`${starred} starred`);
  if (!proposals.length) problems.push('no changes proposed');
  return problems;
}

function scoreThree(proposals, tasks) {
  const problems = [];
  const starred = tasks.filter((t) => t.is_starred).map((t) => t.title);
  if (starred.length > 3) problems.push(`${starred.length} starred`);
  for (const must of ['Renew passport', 'Fix leaky faucet']) if (!starred.includes(must)) problems.push(`${must} not starred`);
  if (!proposals.length) problems.push('no changes proposed');
  return problems;
}

await ensureOllama();
const model = ollamaModel();
const cases = [
  ['week, mid-week', (tb) => weekQuestion(tb, today), 'week'],
  ['week, on a Friday', (tb) => weekQuestion(tb, friday), 'week'],
  ['pick my three', (tb) => threeQuestion(tb, today), 'three'],
];
let pass = 0;
let total = 0;
for (const [name, build, kind] of cases) {
  if (only && !name.toLowerCase().includes(only)) continue;
  for (let r = 1; r <= runs; r++) {
    total++;
    const tb = createToolbox();
    const before = await tasksApi.listTasks();
    const q = await build(tb);
    const t0 = Date.now();
    let problems;
    let steps = 0;
    try {
      tb.setPlanning(kind === 'week');
      ({ steps } = await ask({ question: q.text, model, toolbox: tb, maxSteps: PLAN_STEPS }));
      const tasks = await after(tb.proposals);
      problems = kind === 'week' ? scoreWeek(q.win, before, tb.proposals, tasks) : scoreThree(tb.proposals, tasks);
    } catch (err) {
      problems = [`ERROR ${err.message}`];
    }
    if (!problems.length) pass++;
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${name} #${r}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${steps} steps  ${tb.proposals.length} changes${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`);
  }
}
console.log(`\n${pass}/${total} passed on ${model.label}`);
await unloadModel();
await stopOllama();
