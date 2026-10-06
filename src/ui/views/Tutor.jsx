import { useCallback, useEffect, useRef, useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { Prompt } from '../components/Prompt.jsx';
import { QuickAdd } from '../components/QuickAdd.jsx';
import { cleanText } from '../../lib/sanitize.js';
import * as tutor from '../../lib/tutor.js';

// Magnus Tutor (a separate local app, magnus-tutor): ask a question right here
// with a streamed answer, start a problem-set session (labels a focus round and
// opens the web app on it), ingest notes, add review tasks, jot a journal note.
const MENU = [
  { key: 'a', label: 'Ask a question', desc: 'answered here from your notes and textbooks' },
  { key: 's', label: 'Start problem-set session', desc: 'focus round + office hours in the web app' },
  { key: 'o', label: 'Open the web app', desc: 'the full workspace (math, code, sources)' },
  { key: 'i', label: 'Ingest notes', desc: 'pick up new PDFs in the course folders' },
  { key: 'n', label: 'New course', desc: 'from a syllabus, in the web app' },
  { key: 'j', label: 'Journal note', desc: 'a line about this study session → journal inbox' },
];
const HINTS = '←→ course · ↑↓ enter · a ask · s problem set · o web app · i ingest · n new course · j journal · t review → task · esc home';
const ASK_HINTS = 'f follow-up · w open this conversation in the web app (math rendered) · esc back';

export function Tutor({ params = {} }) {
  const { navigate, notify, capture, startFocus, contentHeight, columns } = useAppCtx();
  const [up, setUp] = useState(null);
  const [courses, setCourses] = useState([]);
  const [ci, setCi] = useState(0);
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState([]);
  const [prompt, setPrompt] = useState(params.mode === 'ask' ? 'ask' : params.mode === 'pset' ? 'pset' : null);
  const [answer, setAnswer] = useState(null); // { q, text, sid, done }
  const [quick, setQuick] = useState(null);
  const ctl = useRef(null);
  useHints(prompt || quick ? null : answer ? ASK_HINTS : HINTS);

  const course = courses[ci] || null;

  const load = useCallback(async () => {
    const alive = await tutor.tutorUp();
    setUp(alive);
    if (!alive) return;
    try {
      const [cs, rv] = await Promise.all([tutor.api.courses(), tutor.api.review()]);
      setCourses(cs);
      setReview(rv);
    } catch (err) {
      notify(`Tutor: ${err.message}`, 'error');
    }
  }, [notify]);
  useEffect(() => {
    load();
    return () => ctl.current?.abort();
  }, [load]);

  const ensure = async () => {
    if (up) return true;
    notify('Starting Magnus Tutor…', 'info');
    try {
      await tutor.ensureTutor();
      await load();
      return true;
    } catch (err) {
      notify(err.message, 'error');
      return false;
    }
  };

  const ask = async (q, sid = null) => {
    setPrompt(null);
    if (!q?.trim() || !(await ensure())) return;
    ctl.current = new AbortController();
    setAnswer({ q, text: '', sid, done: false });
    try {
      const id = await tutor.ask(q, {
        course: course?.slug ?? null,
        sessionId: sid,
        signal: ctl.current.signal,
        onText: (chunk) => setAnswer((a) => (a ? { ...a, text: a.text + cleanText(chunk, { keepNewlines: true }) } : a)),
      });
      setAnswer((a) => (a ? { ...a, sid: id, done: true } : a));
    } catch (err) {
      if (err.name !== 'AbortError') notify(`Tutor: ${err.message}`, 'error');
      setAnswer((a) => (a ? { ...a, done: true } : a));
    }
  };

  const startPset = async (pset) => {
    setPrompt(null);
    if (!(await ensure())) return;
    const name = course?.name || 'study';
    const label = tutor.officeHoursLabel(name, pset.trim());
    await startFocus({ label }); // switches the running round if there is one, keeping the clock
    try {
      const r = await tutor.api.createSession(course?.slug ?? null, 'office_hours', pset.trim() || null);
      await tutor.openWeb(`/session/${r.session.id}`);
      notify(`Office hours: ${name}${pset ? ` · ${pset}` : ''} · opened in the browser`, 'success');
    } catch (err) {
      notify(`Tutor: ${err.message}`, 'error');
    }
  };

  const run = async (key) => {
    if (key === 'a') return setPrompt('ask');
    if (key === 's') return setPrompt('pset');
    if (key === 'j') return setPrompt('journal');
    if (!(await ensure())) return;
    if (key === 'o') return tutor.openWeb(course ? `/course/${course.slug}` : '/');
    if (key === 'n') return tutor.openWeb('/courses/new');
    if (key === 'i') {
      try {
        const r = await tutor.api.scan();
        notify(r.queued?.length ? `Ingesting ${r.queued.length} new PDF${r.queued.length === 1 ? '' : 's'} in the background` : 'No new PDFs in the course folders', 'success');
      } catch (err) {
        notify(`Tutor: ${err.message}`, 'error');
      }
    }
  };

  useViewInput(
    (input, key) => {
      if (answer) {
        if (key.escape) {
          ctl.current?.abort();
          return setAnswer(null);
        }
        if (input === 'f' && answer.done) return setPrompt('follow');
        if (input === 'w' && answer.sid) return tutor.openWeb(`/session/${answer.sid}`);
        return;
      }
      if (key.escape) return navigate('home');
      if (key.leftArrow && courses.length) return setCi((i) => (i - 1 + courses.length) % courses.length);
      if (key.rightArrow && courses.length) return setCi((i) => (i + 1) % courses.length);
      if (key.upArrow) return setIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) return setIndex((i) => Math.min(MENU.length + review.length - 1, i + 1));
      if (key.return) {
        if (index < MENU.length) return run(MENU[index].key);
        const r = review[index - MENU.length];
        if (r) return setQuick(`review: ${r.concept.toLowerCase()} !low +2`);
      }
      if (input === 't' && index >= MENU.length) {
        const r = review[index - MENU.length];
        if (r) return setQuick(`review: ${r.concept.toLowerCase()} !low +2`);
      }
      const m = MENU.find((x) => x.key === input);
      if (m) run(m.key);
    },
    !prompt && !quick
  );

  const status = up === null ? '…' : up ? '● running' : '○ not running (starts when you use it)';
  const width = Math.max(30, columns - 6);
  const answerLines = answer ? Math.max(4, contentHeight - 8) : 0;
  const lines = answer ? answer.text.split('\n') : [];
  const visible = answer && lines.length > answerLines ? lines.slice(-answerLines) : lines;

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <Box>
        <Text bold color={C.accent}>Tutor</Text>
        <Text color={C.muted}>  {status}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={C.muted}>course </Text>
        <Text bold>{course ? `‹ ${course.name} ›` : courses.length ? '' : '(none yet)'}</Text>
        {course && <Text color={C.muted}>  {course.title}</Text>}
      </Box>

      {answer ? (
        <Box flexDirection="column">
          <Text color={C.accent}>› {answer.q}</Text>
          <Box flexDirection="column" marginTop={1} width={width}>
            {visible.map((ln, i) => (
              <Text key={i} wrap="wrap">{ln || ' '}</Text>
            ))}
            {!answer.done && <Text color={C.muted}>…</Text>}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {MENU.map((m, i) => (
            <Box key={m.key}>
              <Text color={i === index ? C.accent : undefined}>{i === index ? '› ' : '  '}</Text>
              <Text color={C.accent}>[{m.key}] </Text>
              <Text bold={i === index}>{m.label.padEnd(28)}</Text>
              <Text color={C.muted}>{m.desc}</Text>
            </Box>
          ))}
          {!!review.length && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={C.muted}>To review (t or enter → quick add a task)</Text>
              {review.slice(0, Math.max(3, contentHeight - MENU.length - 8)).map((r, j) => {
                const i = MENU.length + j;
                return (
                  <Box key={`${r.course}-${r.concept}`}>
                    <Text color={i === index ? C.accent : undefined}>{i === index ? '› ' : '  '}</Text>
                    <Text>{r.concept}</Text>
                    <Text color={C.muted}>  {r.course} · {r.reason}</Text>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {prompt === 'ask' || prompt === 'follow' ? (
        <Prompt
          label={prompt === 'follow' ? 'Follow-up' : `Ask${course ? ` (${course.name})` : ''}`}
          placeholder="Why is the field inside a conductor zero?"
          onSubmit={(v) => ask(v, prompt === 'follow' ? answer?.sid : null)}
          onCancel={() => setPrompt(null)}
        />
      ) : null}
      {prompt === 'pset' ? (
        <Prompt label={`Problem set${course ? ` (${course.name})` : ''}`} placeholder="PSet 3" hint="labels the focus round “office hours: course pset” · enter to start · esc to cancel"
          onSubmit={startPset} onCancel={() => setPrompt(null)} />
      ) : null}
      {prompt === 'journal' ? (
        <Prompt label="Journal note" initial={`Studied ${course?.name || ''}: `} onCancel={() => setPrompt(null)}
          onSubmit={async (v) => {
            setPrompt(null);
            if (!v.trim()) return;
            const res = await capture('capture', [v.trim()]);
            notify(res.ok ? 'Added to the journal inbox' : res.stderr.trim() || 'capture failed', res.ok ? 'success' : 'error');
          }} />
      ) : null}
      {quick ? <QuickAdd initial={quick} onClose={() => setQuick(null)} /> : null}
    </Box>
  );
}
