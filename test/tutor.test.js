// Magnus ⇄ Magnus Tutor: the client, `magnus tutor ask`, and the Tutor view
// (ask streaming, problem-set session starting a labelled focus round).
import './_demo.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import React from 'react';
import { render } from 'ink-testing-library';
import { build } from 'esbuild';
import * as tutor from '../src/lib/tutor.js';

// Views are JSX; compile the Tutor view (and the context it uses) for this test.
// Inside the repo (dist/ is git-ignored) so `react` and `ink` resolve from node_modules.
const out = path.resolve('dist', 'test-tutor-view.mjs');
await build({
  stdin: { contents: "export { Tutor } from './src/ui/views/Tutor.jsx'; export { AppContext } from './src/ui/context.js';", resolveDir: path.resolve('.'), loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', outfile: out, logLevel: 'silent',
});
const { Tutor, AppContext } = await import(out);

const run = promisify(execFile);
let server;
const seen = [];

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ url: req.url, method: req.method, body });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/api/health') return res.end('{"ok":true}');
      if (req.url === '/api/courses') return res.end(JSON.stringify([{ slug: 'em', name: 'E&M', title: 'Electricity and Magnetism' }]));
      if (req.url === '/api/review') return res.end(JSON.stringify([{ course: 'em', concept: "Gauss's law", reason: 'needed the next-step hint' }]));
      if (req.url === '/api/sessions' && req.method === 'POST') return res.end(JSON.stringify({ session: { id: 42 } }));
      if (req.url === '/api/ask') {
        res.setHeader('content-type', 'text/plain');
        res.setHeader('x-session-id', '7');
        res.write('The field inside ');
        setTimeout(() => res.end('a conductor is zero [S1].\n\nSources: Textbook §6.4, p. 265\n'), 30);
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.MAGNUS_TUTOR_URL = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('office hours labels and the tutor client', async () => {
  assert.equal(tutor.officeHoursLabel('E&M', 'PSet 3'), 'office hours: E&M PSet 3');
  assert.equal(await tutor.tutorUp(), true);
  let text = '';
  const sid = await tutor.ask('why zero?', { course: 'em', onText: (t) => (text += t) });
  assert.equal(sid, 7);
  assert.match(text, /conductor is zero/);
});

test('`magnus tutor ask` streams the answer in the terminal', async () => {
  const { stdout } = await run(process.execPath, [path.resolve('bin/magnus.js'), 'tutor', 'ask', 'why', 'zero?', '--course', 'em'], { env: { ...process.env } });
  assert.match(stdout, /The field inside a conductor is zero/);
  assert.match(stdout, /session\/7/);
  const req = seen.filter((s) => s.url === '/api/ask').at(-1);
  assert.deepEqual(JSON.parse(req.body), { text: 'why zero?', course: 'em', session_id: null });
});

function harness(overrides = {}) {
  const calls = { focus: [], notes: [] };
  const ctx = {
    navigate: () => {},
    notify: (m) => calls.notes.push(m),
    capture: async () => ({ ok: true, stderr: '' }),
    startFocus: async (to) => calls.focus.push(to),
    contentHeight: 30,
    columns: 100,
    setHints: () => {},
    searchOpen: false,
    overlayOpen: false,
    setCaptureCount: () => {},
    ...overrides,
  };
  return { ctx, calls };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Tutor view: courses, review items, and an answer streamed in place', async () => {
  const { ctx } = harness();
  const ui = render(React.createElement(AppContext.Provider, { value: ctx }, React.createElement(Tutor, { params: {} })));
  await wait(150);
  assert.match(ui.lastFrame(), /‹ E&M ›/);
  assert.match(ui.lastFrame(), /Gauss's law/);
  ui.stdin.write('a');
  await wait(50);
  ui.stdin.write('Why is the field zero?');
  await wait(20);
  ui.stdin.write('\r');
  await wait(250);
  assert.match(ui.lastFrame(), /conductor is zero/);
  ui.unmount();
});

test('Tutor view: a problem-set session labels the focus round and opens the session', async () => {
  const { ctx, calls } = harness();
  const opened = [];
  const origOpen = tutor.openWeb;
  const ui = render(React.createElement(AppContext.Provider, { value: ctx }, React.createElement(Tutor, { params: { mode: 'pset' } })));
  await wait(150);
  ui.stdin.write('PSet 3');
  await wait(20);
  ui.stdin.write('\r');
  await wait(300);
  assert.deepEqual(calls.focus, [{ label: 'office hours: E&M PSet 3' }]);
  const created = seen.filter((s) => s.url === '/api/sessions' && s.method === 'POST').at(-1);
  assert.deepEqual(JSON.parse(created.body), { course: 'em', mode: 'office_hours', title: 'PSet 3' });
  void opened;
  void origOpen;
  ui.unmount();
});
