// Planning sessions: the week window, the questions, the Markdown and
// saving through `jweek --plan` (a stub jweek on PATH; no real journal).
import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planWindow, planMarkdown, savePlan, weekQuestion, threeQuestion } from '../src/lib/assistant/plan.js';
import { createToolbox } from '../src/lib/assistant/tools.js';

test('the plan covers the rest of this week, or next week from Friday on', () => {
  assert.deepEqual(
    Object.fromEntries(['2026-10-26', '2026-10-29', '2026-10-30', '2026-11-01'].map((d) => [d, [planWindow(d).start, planWindow(d).end, planWindow(d).review]])),
    {
      '2026-10-26': ['2026-10-26', '2026-11-01', '2026-W44'],
      '2026-10-29': ['2026-10-29', '2026-11-01', '2026-W44'],
      '2026-10-30': ['2026-11-02', '2026-11-08', '2026-W44'],
      '2026-11-01': ['2026-11-02', '2026-11-08', '2026-W44'],
    }
  );
});

test('the questions carry the data and the refs update_task needs', async () => {
  const tb = createToolbox();
  const week = await weekQuestion(tb, '2026-10-30');
  assert.match(week.text, /Mon 2026-11-02/);
  assert.match(week.text, /"ref":"t\d+"/);
  assert.match(week.text, /Renew passport/);
  assert.equal(week.label, 'Plan next week');
  const three = await threeQuestion(tb, '2026-10-29');
  assert.match(three.text, /at most 3 can be starred/);
});

test('the saved plan lists each day as planned', () => {
  const win = planWindow('2026-10-30');
  const md = planMarkdown(win, [
    { title: 'Pay rent', status: 'todo', due_date: '2026-11-02', is_starred: true, repeat: 'monthly:1' },
    { title: 'Old', status: 'done', due_date: '2026-11-02' },
  ]);
  assert.match(md, /^## Plan for next week \(Nov 2 – Nov 8\)/);
  assert.match(md, /\*\*Mon Nov 2\*\* — Pay rent ↻/);
  assert.match(md, /\*\*Tue Nov 3\*\* — free/);
  assert.doesNotMatch(md, /Old/);
  assert.match(md, /\*\*Starred:\*\* Pay rent/);
});

test('savePlan hands the Markdown to jweek --plan', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-plan-'));
  const log = path.join(dir, 'jweek.log');
  fs.writeFileSync(path.join(dir, 'jweek'), `#!/bin/sh\necho "$@" > "${log}"\ncat >> "${log}"\necho "Saved the plan; it goes into reviews/x.md when you write that review (jweek)"\n`, { mode: 0o755 });
  const PATH = process.env.PATH;
  process.env.PATH = `${dir}:${PATH}`;
  try {
    const res = await savePlan(planWindow('2026-10-30'), [{ title: 'Pay rent', status: 'todo', due_date: '2026-11-02' }]);
    assert.equal(res.ok, true);
    const got = fs.readFileSync(log, 'utf8');
    assert.match(got, /^--plan --week 2026-W44\n## Plan for next week/);
    assert.match(got, /Pay rent/);
    assert.match(res.message, /when you write that review/, "jweek's own words");
  } finally {
    process.env.PATH = PATH;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('while planning the week, repeating tasks keep their dates', async () => {
  const tb = createToolbox();
  const run = async (name, args) => JSON.parse((await tb.run(name, args)).result);
  const water = (await run('find_tasks', { text: 'water' })).tasks[0];
  tb.setPlanning(true);
  assert.match((await run('update_task', { ref: water.ref, due: 'sat' })).error, /repeats/);
  assert.match((await run('update_task', { ref: water.ref, due: 'none' })).error, /repeats/, 'no clearing the date');
  assert.match((await run('update_task', { ref: water.ref, repeat: 'none' })).error, /repeats/, 'no un-repeating either');
  assert.equal(tb.proposals.length, 0);
  tb.setPlanning(false);
  assert.match((await run('update_task', { ref: water.ref, due: '+5' })).proposed, /due /, 'a plain request can still move it');
});
