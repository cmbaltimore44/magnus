// Repeating tasks (schema_008): ~tokens, next dates, quick add, the demo
// stand-in for the database trigger, and Ask Magnus. The SQL next_due was
// checked against nextDue on the same rules (thousands of dates) in PGlite.
import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepeatToken, nextDue, firstDue, describeRepeat, ruleToToken, RULE_PATTERN } from '../src/lib/repeat.js';
import { parseQuickAdd, describeQuickAdd } from '../src/lib/quickadd.js';
import * as tasksApi from '../src/lib/data/tasks.js';
import { createToolbox } from '../src/lib/assistant/tools.js';

const THU = '2026-10-29';

test('~tokens become rules', () => {
  const cases = {
    '~daily': 'daily',
    '~weekdays': 'weekdays',
    '~weekly': 'weekly:thu',
    '~mon': 'weekly:mon',
    '~thu,mon': 'weekly:mon,thu',
    '~tues,fri': 'weekly:tue,fri',
    '~monthly': 'monthly:29',
    '~1st': 'monthly:1',
    '~22nd': 'monthly:22',
    '~last': 'monthly:last',
    '~yearly': 'yearly:10-29',
    '~3d': 'every:3d',
    '~2w': 'every:2w',
    '~6m': 'every:6m',
  };
  for (const [token, rule] of Object.entries(cases)) {
    assert.equal(parseRepeatToken(token, THU), rule, token);
    assert.match(rule, RULE_PATTERN);
  }
  for (const bad of ['~', '~32nd', '~0d', '~1000d', '~sometimes', 'weekly', '~th']) assert.equal(parseRepeatToken(bad, THU), null, bad);
});

test('next dates count from the due date and clamp to short months', () => {
  assert.equal(nextDue('monthly:last', '2026-01-31'), '2026-02-28');
  assert.equal(nextDue('monthly:31', '2028-02-01'), '2028-02-29');
  assert.equal(nextDue('monthly:1', '2026-11-01'), '2026-12-01');
  assert.equal(nextDue('weekdays', '2026-10-30'), '2026-11-02');
  assert.equal(nextDue('weekly:mon,thu', THU), '2026-11-02');
  assert.equal(nextDue('yearly:02-29', '2026-03-01'), '2027-02-28');
  assert.equal(nextDue('every:2w', THU), '2026-11-12');
  assert.equal(nextDue('every:1m', '2026-01-31'), '2026-02-28');
  assert.equal(firstDue('monthly:1', THU), '2026-11-01');
  assert.equal(firstDue('weekly:thu', THU), THU, 'today counts');
  assert.equal(firstDue('every:3d', THU), THU);
});

test('rules read back as words and as tokens', () => {
  assert.equal(describeRepeat('weekly:mon,thu'), 'every Monday and Thursday');
  assert.equal(describeRepeat('monthly:1'), 'monthly on the 1st');
  assert.equal(describeRepeat('monthly:22'), 'monthly on the 22nd');
  assert.equal(describeRepeat('every:1w'), 'every week');
  assert.equal(describeRepeat('every:3d'), 'every 3 days');
  assert.equal(describeRepeat('yearly:10-29'), 'yearly on Oct 29');
  for (const rule of ['daily', 'weekdays', 'weekly:mon,thu', 'monthly:1', 'monthly:last', 'every:3d'])
    assert.equal(parseRepeatToken(ruleToToken(rule), THU), rule, rule);
});

test('quick add: a ~token sets the rule and, without a date, the first due date', () => {
  const now = new Date(`${THU}T12:00:00`);
  const rent = parseQuickAdd('pay rent ~1st !high', [], now);
  assert.equal(rent.title, 'pay rent');
  assert.equal(rent.repeat, 'monthly:1');
  assert.equal(rent.due_date, '2026-11-01');
  const review = parseQuickAdd('weekly review ~weekly sun', [], now);
  assert.equal(review.repeat, 'weekly:sun', '~weekly anchors on the due date, wherever the date is typed');
  assert.equal(review.due_date, '2026-11-01');
  assert.equal(parseQuickAdd('read ~sometimes', [], now).title, 'read ~sometimes', 'unknown tokens stay in the title');
  assert.equal(parseQuickAdd('call mom', [], now).repeat, undefined, 'no repeat key unless set');
  assert.match(describeQuickAdd(rent), /↻ monthly on the 1st/);
});

test('finishing a repeating task makes the next one (demo stand-in for the trigger)', async () => {
  const before = await tasksApi.listTasks();
  const plants = before.find((t) => t.title === 'Water the plants');
  await tasksApi.updateTask(plants.id, { status: 'done' });
  const after = await tasksApi.listTasks();
  const copies = after.filter((t) => t.title === 'Water the plants');
  assert.equal(copies.length, 2);
  const next = copies.find((t) => t.status === 'todo');
  assert.equal(next.repeat, 'every:3d');
  assert.equal(next.due_date, nextDue('every:3d', plants.due_date));
  assert.equal(copies.find((t) => t.id === plants.id).repeat, null, 'the finished one loses its rule');
  await tasksApi.updateTask(plants.id, { status: 'todo' });
  await tasksApi.updateTask(plants.id, { status: 'done' });
  assert.equal((await tasksApi.listTasks()).filter((t) => t.title === 'Water the plants').length, 2, 'no second copy');
});

test('Ask Magnus can set and stop a repeat, and shows it', async () => {
  const tb = createToolbox();
  const run = async (name, args) => JSON.parse((await tb.run(name, args)).result);
  const { tasks } = await run('find_tasks', { text: 'faucet' });
  assert.match((await run('update_task', { ref: tasks[0].ref, repeat: '~1st' })).proposed, /repeat monthly on the 1st/);
  assert.equal(tb.proposals[0].changes.repeat, 'monthly:1');
  const water = (await run('find_tasks', { text: 'water' })).tasks.find((t) => t.repeats);
  assert.equal(water?.repeats, 'every 3 days');
  assert.match((await run('update_task', { ref: water.ref, repeat: 'none' })).proposed, /stop repeating/);
  await run('add_task', { text: 'pay rent ~1st' });
  assert.equal(tb.proposals.at(-1).fields.repeat, 'monthly:1');
});

test('reopening or undoing a finished repeating task takes back its next copy', async () => {
  const title = 'Pay rent (undo test)';
  const created = await tasksApi.createTask('00000000-0000-4000-8000-000000000000', { title, status: 'todo', due_date: '2026-11-01', priority: 'medium', repeat: 'monthly:1' }, 99);
  const done = await tasksApi.updateTask(created.id, { status: 'done' });
  const copy = await tasksApi.findSpawnedCopy(done);
  assert.equal(copy?.due_date, '2026-12-01');
  const { row, removedId } = await tasksApi.reopenTask(done, { status: 'todo' });
  assert.equal(removedId, copy.id);
  assert.equal(row.repeat, 'monthly:1');
  assert.equal(row.status, 'todo');
  assert.equal((await tasksApi.listTasks()).filter((t) => t.title === title).length, 1, 'no leftover copy');
  // A plain task reopens normally.
  const plain = await tasksApi.createTask('00000000-0000-4000-8000-000000000000', { title: 'plain (undo test)', status: 'todo', priority: 'medium' }, 100);
  const plainDone = await tasksApi.updateTask(plain.id, { status: 'done' });
  assert.equal((await tasksApi.reopenTask(plainDone, { status: 'todo' })).removedId, null);
});

test('Ask: undoing "mark done" on a repeating task restores it fully', async () => {
  const { applyProposals } = await import('../src/lib/assistant/apply.js');
  const tb = createToolbox();
  const run = async (name, args) => JSON.parse((await tb.run(name, args)).result);
  await tasksApi.createTask('00000000-0000-4000-8000-000000000000', { title: 'Stretch (ask undo)', status: 'todo', due_date: '2026-11-02', priority: 'low', repeat: 'daily' }, 101);
  const ref = (await run('find_tasks', { text: 'ask undo' })).tasks[0].ref;
  await run('update_task', { ref, status: 'done' });
  const { restore } = await applyProposals('00000000-0000-4000-8000-000000000000', tb.proposals);
  assert.equal((await tasksApi.listTasks()).filter((t) => t.title === 'Stretch (ask undo)').length, 2);
  await restore();
  const rows = (await tasksApi.listTasks()).filter((t) => t.title === 'Stretch (ask undo)');
  assert.deepEqual(rows.map((t) => [t.status, t.repeat]), [['todo', 'daily']]);
});

test('a next copy you have edited, started or starred is never taken back', async () => {
  const user = '00000000-0000-4000-8000-000000000000';
  for (const [i, edit] of [{ notes: 'call landlord first' }, { status: 'doing' }, { is_starred: true }, { due_date: '2027-01-15' }].entries()) {
    const title = `Edited copy ${i}`;
    const t = await tasksApi.createTask(user, { title, status: 'todo', due_date: '2026-11-01', priority: 'medium', repeat: 'monthly:1' }, 200 + i);
    const done = await tasksApi.updateTask(t.id, { status: 'done' });
    const copy = (await tasksApi.listTasks()).find((x) => x.title === title && x.id !== t.id);
    await tasksApi.updateTask(copy.id, edit);
    const { removedId } = await tasksApi.reopenTask(done, { status: 'todo' });
    assert.equal(removedId, null, JSON.stringify(edit));
    assert.equal((await tasksApi.listTasks()).filter((x) => x.title === title).length, 2, 'both stay');
  }
});

test('Ask: moving a finished repeating task back to To Do takes back its next copy', async () => {
  const { applyProposals } = await import('../src/lib/assistant/apply.js');
  const user = '00000000-0000-4000-8000-000000000000';
  const title = 'Back to do (ask)';
  const t = await tasksApi.createTask(user, { title, status: 'todo', due_date: '2026-11-02', priority: 'low', repeat: 'daily' }, 300);
  await tasksApi.updateTask(t.id, { status: 'done' });
  const tb = createToolbox();
  const run = async (name, args) => JSON.parse((await tb.run(name, args)).result);
  const ref = (await run('find_tasks', { text: 'back to do', status: 'all' })).tasks.find((x) => x.status === 'done').ref;
  await run('update_task', { ref, status: 'todo' });
  await applyProposals(user, tb.proposals);
  const rows = (await tasksApi.listTasks()).filter((x) => x.title === title);
  assert.deepEqual(rows.map((x) => [x.status, x.repeat]), [['todo', 'daily']]);
});
