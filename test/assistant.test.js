// Ask Magnus: tools, the loop, applying proposals with undo, and the Ollama
// adapter, all on demo data with a scripted model (no real model runs).
import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createToolbox } from '../src/lib/assistant/tools.js';
import { ask, MAX_STEPS } from '../src/lib/assistant/loop.js';
import { applyProposals } from '../src/lib/assistant/apply.js';
import { parseBattery, parsePressure } from '../src/lib/assistant/resources.js';
import * as tasksApi from '../src/lib/data/tasks.js';
import * as logsApi from '../src/lib/data/logs.js';
import { todayISO, addDays } from '../src/lib/data/completions.js';
import { parseDateInput } from '../src/lib/dates.js';

const USER = '00000000-0000-4000-8000-000000000000';
const run = async (tb, name, args) => JSON.parse((await tb.run(name, args)).result);

// A model that replays scripted turns: each is { text?, calls?: [[name, args]] }.
function scripted(turns) {
  let i = 0;
  const seen = [];
  return {
    provider: 'test',
    label: 'scripted',
    seen,
    async chat({ transcript, tools }) {
      seen.push({ transcript: structuredClone(transcript), tools: tools.length });
      const t = turns[Math.min(i++, turns.length - 1)];
      return { text: t.text || '', toolCalls: (t.calls || []).map(([name, args], n) => ({ id: `c${i}_${n}`, name, args })) };
    },
  };
}

test('find_tasks returns short refs and filters by due date', async () => {
  const tb = createToolbox();
  const overdue = await run(tb, 'find_tasks', { due: 'overdue' });
  assert.equal(overdue.count, 1);
  assert.equal(overdue.tasks[0].title, 'Renew passport');
  assert.match(overdue.tasks[0].ref, /^t\d+$/);
  const again = await run(tb, 'find_tasks', { text: 'passport' });
  assert.equal(again.tasks[0].ref, overdue.tasks[0].ref, 'refs stay stable in a conversation');
});

test('write tools only propose: nothing changes until applied', async () => {
  const tb = createToolbox();
  const { tasks } = await run(tb, 'find_tasks', { text: 'faucet' });
  const before = (await tasksApi.listTasks()).find((t) => t.title === 'Fix leaky faucet');
  const res = await run(tb, 'update_task', { ref: tasks[0].ref, due: 'sat' });
  assert.match(res.proposed, /Fix leaky faucet/);
  const after = (await tasksApi.listTasks()).find((t) => t.title === 'Fix leaky faucet');
  assert.equal(after.due_date, before.due_date);
  assert.equal(tb.proposals.length, 1);
  assert.equal(tb.proposals[0].changes.due_date, parseDateInput('sat'));
});

test('the star cap counts pending stars and unstars', async () => {
  const tb = createToolbox();
  const dentist = (await run(tb, 'find_tasks', { text: 'dentist' })).tasks[0].ref;
  const planning = (await run(tb, 'find_tasks', { text: 'planning' })).tasks[0].ref;
  assert.match((await run(tb, 'update_task', { ref: dentist, starred: true })).error, /already 3 starred/);
  await run(tb, 'update_task', { ref: planning, starred: false });
  assert.match((await run(tb, 'update_task', { ref: dentist, starred: true })).proposed, /star/);
});

test('add_task reads quick-add tokens; log validates', async () => {
  const tb = createToolbox();
  await run(tb, 'add_task', { text: 'call mom tom !high #home' });
  const p = tb.proposals[0];
  assert.equal(p.fields.title, 'call mom');
  assert.equal(p.fields.due_date, addDays(todayISO(), 1));
  assert.equal(p.fields.priority, 'high');
  assert.ok(p.fields.category_id);
  assert.match((await run(tb, 'log', { metric: 'mood', value: 9 })).error, /1–5/);
  assert.match((await run(tb, 'update_task', { ref: 't999', due: 'fri' })).error, /unknown task ref/);
});

test('the loop runs tools, collects proposals and answers', async () => {
  const tb = createToolbox();
  const model = scripted([
    { calls: [['find_tasks', { text: 'faucet' }]] },
    { calls: [['update_task', { ref: 't1', due: 'fri' }]] },
    { text: "I've proposed moving Fix leaky faucet to Friday." },
  ]);
  const trace = [];
  const res = await ask({ question: 'move the faucet task to friday', model, toolbox: tb, onTrace: (l) => trace.push(l) });
  assert.equal(res.answer, "I've proposed moving Fix leaky faucet to Friday.");
  assert.equal(tb.proposals.length, 1);
  assert.deepEqual(trace, ['tasks (“faucet”)']);
  const toolMsg = model.seen[1].transcript.at(-1);
  assert.equal(toolMsg.role, 'tool');
  assert.match(toolMsg.results[0].content, /Fix leaky faucet/);
});

test('the loop nudges a model that claims a change without calling a tool', async () => {
  const tb = createToolbox();
  const model = scripted([
    { text: "I've proposed adding call mom." },
    { calls: [['add_task', { text: 'call mom tom' }]] },
    { text: "I've proposed adding call mom for tomorrow." },
  ]);
  const res = await ask({ question: 'add call mom tomorrow', model, toolbox: tb });
  assert.equal(tb.proposals.length, 1);
  assert.match(res.answer, /tomorrow/);
});

test('the loop stops after MAX_STEPS and asks for a final answer', async () => {
  const tb = createToolbox();
  const model = scripted([...Array(MAX_STEPS).fill({ calls: [['upcoming', {}]] }), { text: 'Here is what I found.' }]);
  const res = await ask({ question: 'loop forever', model, toolbox: tb });
  assert.equal(res.answer, 'Here is what I found.');
  assert.equal(res.steps, MAX_STEPS + 1);
});

test('applying proposals writes them, and restore puts everything back', async () => {
  const tb = createToolbox();
  const faucet = (await run(tb, 'find_tasks', { text: 'faucet' })).tasks[0].ref;
  await run(tb, 'update_task', { ref: faucet, due: 'sat', priority: 'low' });
  await run(tb, 'add_task', { text: 'assistant test task fri' });
  const day = addDays(todayISO(), -3);
  await run(tb, 'log', { metric: 'sleep', value: 6.5, date: day });
  await run(tb, 'log', { metric: 'workout', value: 25, note: 'swim' });

  const tasksBefore = await tasksApi.listTasks();
  const logsBefore = await logsApi.listLogs(addDays(todayISO(), -10));
  const { applied, error, restore } = await applyProposals(USER, tb.proposals);
  assert.equal(error, null);
  assert.equal(applied, 4);
  const tasksMid = await tasksApi.listTasks();
  assert.equal(tasksMid.find((t) => t.title === 'Fix leaky faucet').due_date, parseDateInput('sat'));
  assert.ok(tasksMid.some((t) => t.title === 'assistant test task'));

  await restore();
  const tasksAfter = await tasksApi.listTasks();
  const faucetAfter = tasksAfter.find((t) => t.title === 'Fix leaky faucet');
  const faucetBefore = tasksBefore.find((t) => t.title === 'Fix leaky faucet');
  assert.equal(faucetAfter.due_date, faucetBefore.due_date);
  assert.equal(faucetAfter.priority, faucetBefore.priority);
  assert.ok(!tasksAfter.some((t) => t.title === 'assistant test task'));
  const logsAfter = await logsApi.listLogs(addDays(todayISO(), -10));
  const pick = (rows) => rows.map((e) => `${e.entry_date} ${e.metric} ${Number(e.value)}`).sort();
  assert.deepEqual(pick(logsAfter), pick(logsBefore));
});

test('the Ollama adapter streams text, parses tool calls and sends the memory limits', async () => {
  let body = null;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      body = JSON.parse(raw);
      res.writeHead(200, { 'content-type': 'application/x-ndjson' });
      res.write(`${JSON.stringify({ message: { role: 'assistant', content: 'Look' } })}\n`);
      res.write(`${JSON.stringify({ message: { role: 'assistant', content: 'ing.', tool_calls: [{ function: { name: 'find_tasks', arguments: { due: 'today' } } }] } })}\n`);
      res.end(`${JSON.stringify({ done: true })}\n`);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.MAGNUS_OLLAMA_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const { ollamaModel } = await import('../src/lib/assistant/models/ollama.js');
    const chunks = [];
    const out = await ollamaModel({ model: 'test-model' }).chat({
      system: 'sys',
      transcript: [{ role: 'user', text: 'hi' }],
      tools: createToolbox().defs,
      onText: (c) => chunks.push(c),
    });
    assert.equal(out.text, 'Looking.');
    assert.deepEqual(chunks, ['Look', 'ing.']);
    assert.equal(out.toolCalls[0].name, 'find_tasks');
    assert.deepEqual(out.toolCalls[0].args, { due: 'today' });
    assert.equal(body.model, 'test-model');
    assert.equal(body.keep_alive, '2m');
    assert.equal(body.options.num_ctx, 8192);
    assert.equal(body.think, false);
    assert.equal(body.messages[0].role, 'system');
  } finally {
    delete process.env.MAGNUS_OLLAMA_URL;
    server.close();
  }
});

test('resource checks read pressure and battery', () => {
  assert.equal(parsePressure('1\n'), 1);
  assert.equal(parsePressure(''), null);
  assert.deepEqual(parseBattery("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t12%; discharging"), { onBattery: true, percent: 12 });
  assert.deepEqual(parseBattery("Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t80%; charged"), { onBattery: false, percent: 80 });
});

test('magnus ask --yes refuses big batches and finishing tasks', async () => {
  const { yesRefusal, YES_LIMIT } = await import('../src/askCommand.js');
  const upd = (changes) => ({ kind: 'update_task', changes });
  assert.equal(yesRefusal([upd({ due_date: '2026-11-02' })]), null);
  assert.match(yesRefusal([upd({ status: 'done' })]), /never marks tasks done/);
  assert.match(yesRefusal(Array.from({ length: YES_LIMIT + 1 }, () => upd({ priority: 'high' }))), /at most/);
});

test('update_task: a blank due date means no change; "none" clears it', async () => {
  const tb = createToolbox();
  const run = async (name, args) => JSON.parse((await tb.run(name, args)).result);
  const t = (await run('find_tasks', { text: 'planning doc' })).tasks[0];
  const res = await run('update_task', { ref: t.ref, starred: false, due: '', title: '' });
  assert.equal(Object.keys(tb.proposals[0].changes).join(), 'is_starred', `${JSON.stringify(res)}`);
  await run('update_task', { ref: t.ref, due: 'none' });
  assert.equal(tb.proposals[0].changes.due_date, null);
});

test('the last turn after the step limit keeps the tools but forbids calling them', async () => {
  const tb = createToolbox();
  const seen = [];
  const model = {
    async chat(args) {
      seen.push({ tools: args.tools.length, toolChoice: args.toolChoice });
      return seen.length <= MAX_STEPS ? { text: '', toolCalls: [{ id: `c${seen.length}`, name: 'upcoming', args: {} }] } : { text: 'done', toolCalls: [] };
    },
  };
  await ask({ question: 'loop', model, toolbox: tb });
  assert.deepEqual(seen.at(-1), { tools: tb.defs.length, toolChoice: 'none' });
});
