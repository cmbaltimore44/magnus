import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import wrapAnsi from 'wrap-ansi';
import { C } from '../../lib/theme.js';
import { useAppCtx, useCapture, useHints, useViewInput } from '../context.js';
import { cleanText } from '../../lib/sanitize.js';
import { getAssistant } from '../../lib/assistant/index.js';
import { assistantSettings } from '../../lib/assistant/models/ollama.js';
import { getPref } from '../../lib/prefs.js';
import { DEFAULT_CLAUDE_MODEL } from '../../lib/assistant/models/claude.js';
import { PLAN_STEPS, savePlan } from '../../lib/assistant/plan.js';
import { listTasks } from '../../lib/data/tasks.js';

// Ask Magnus: questions about your tasks, routines, Log, focus time and
// library, answered by the local model (or Claude, with c). Changes it
// proposes are listed for you to check: nothing is written until you press
// enter on them, and u undoes the whole batch.
const INPUT_HINTS = 'enter ask · esc home';
const ANSWERED_HINTS = 'enter follow-up · c ask Claude instead · n new conversation · ↑↓ scroll · esc home';
const REVIEW_HINTS = '↑↓ move · space keep/drop · enter apply the kept ones · x discard all · esc back';
const BUSY_HINTS = 'esc stop';
const BLOCKED_HINTS = 'c ask Claude · enter run locally anyway · esc cancel';

// The conversation outlives the view (leave Ask and come back to it).
let savedLog = [];

function AskInput({ onSubmit }) {
  useCapture();
  const [value, setValue] = useState('');
  return (
    <Box borderStyle="round" borderColor={C.accent} paddingX={1}>
      <Text color={C.accent} bold>
        Ask{' '}
      </Text>
      <TextInput value={value} onChange={setValue} placeholder="what's overdue? · move the faucet task to friday · log 7 h sleep" onSubmit={(v) => v.trim() && onSubmit(v.trim())} />
    </Box>
  );
}

export function Ask({ params = {} }) {
  const { navigate, notify, userId, offerUndo, dataChanged, contentHeight, columns } = useAppCtx();
  const assistant = getAssistant();
  const [log, setLog] = useState(savedLog); // [{ q, provider, model, trace: [], text, error, done }]
  const [mode, setMode] = useState(() => (assistant.proposals.length ? 'review' : savedLog.length ? 'answered' : 'input'));
  const [proposals, setProposals] = useState(() => assistant.proposals.map((p) => ({ p, keep: true })));
  const [pIndex, setPIndex] = useState(0);
  const [blocked, setBlocked] = useState(null); // { reason, question }
  const [scroll, setScroll] = useState(0);
  const ctl = useRef(null);
  const answeredHints = proposals.length ? ANSWERED_HINTS.replace('n new conversation', 'p review changes · n new conversation') : ANSWERED_HINTS;
  useHints({ input: INPUT_HINTS, answered: answeredHints, review: REVIEW_HINTS, busy: BUSY_HINTS, blocked: BLOCKED_HINTS }[mode]);

  useEffect(() => {
    savedLog = log;
  }, [log]);
  // Leaving Ask frees the local model's memory right away (the conversation stays).
  useEffect(() => () => {
    ctl.current?.abort();
    // The aborted run can't update this view any more: mark its answer stopped here.
    savedLog = savedLog.map((e) => (e.done ? e : { ...e, done: true, error: e.error || 'stopped' }));
    assistant.release();
  }, [assistant]);

  const update = (fn) => setLog((l) => l.map((e, i) => (i === l.length - 1 ? fn(e) : e)));

  // question: plain text, or a planning preset { label, text, win? } (plan.js).
  const busy = useRef(false); // one question or one apply at a time (key repeat, a second enter)
  const run = async (question, provider = 'local', { force = false } = {}) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await runOnce(question, provider, { force });
    } finally {
      busy.current = false;
    }
  };

  const runOnce = async (question, provider, { force }) => {
    setBlocked(null);
    setMode('busy'); // before the model starts: keys wait until it answers
    // This question's own stop switch, from the start: esc (or leaving Ask)
    // while Ollama is still starting stops this one, not the last.
    const controller = new AbortController();
    ctl.current = controller;
    const preset = typeof question === 'object' ? question : null;
    const text = preset ? preset.text : question;
    if (provider === 'local') {
      try {
        const ready = await assistant.prepareLocal({ force });
        if (controller.signal.aborted) return setMode(log.length ? 'answered' : 'input');
        if (!ready.ok) {
          setBlocked({ reason: ready.reason, question });
          return setMode('blocked');
        }
      } catch (err) {
        notify(cleanText(String(err.message), { keepNewlines: false }), 'error');
        return setMode(log.length ? 'answered' : 'input');
      }
    }
    const model = provider === 'claude' ? getPref('assistantClaudeModel', DEFAULT_CLAUDE_MODEL) : assistantSettings().model;
    setLog((l) => [...l, { q: preset ? preset.label : question, ask: question, win: preset?.win, provider, model, trace: [], text: '', error: null, done: false }]);
    setScroll(0);
    setMode('busy');
    try {
      await assistant.ask(text, {
        provider,
        maxSteps: preset ? PLAN_STEPS : undefined,
        planning: Boolean(preset?.win),
        signal: controller.signal,
        onTrace: (line) => update((e) => ({ ...e, trace: [...e.trace, line] })),
        onText: (chunk, info = {}) => update((e) => ({ ...e, text: info.discard ? '' : e.text + cleanText(chunk ?? '', { keepNewlines: true }) })),
      });
      update((e) => ({ ...e, done: true }));
    } catch (err) {
      const stopped = err.name === 'AbortError' || controller.signal.aborted;
      update((e) => ({ ...e, done: true, error: stopped ? 'stopped' : cleanText(String(err.message), { keepNewlines: false }) }));
    }
    const pending = assistant.proposals;
    setProposals(pending.map((p) => ({ p, keep: true })));
    setPIndex(0);
    setMode(pending.length ? 'review' : 'answered');
  };

  const apply = async () => {
    if (busy.current) return;
    const chosen = proposals.filter((x) => x.keep).map((x) => x.p);
    if (!chosen.length) return discard();
    busy.current = true;
    let res;
    try {
      res = await assistant.apply(userId, chosen);
    } finally {
      busy.current = false;
    }
    setProposals([]);
    setMode('answered');
    update((e) => ({ ...e, applied: res.applied }));
    if (res.applied) {
      dataChanged();
      offerUndo(`Applied ${res.applied} change${res.applied === 1 ? '' : 's'}`, res.restore);
    }
    if (res.error) return notify(`Stopped after ${res.applied}: ${cleanText(res.error.message, { keepNewlines: false })}`, 'error');
    // An accepted week plan goes into the week's review (jweek --plan).
    const win = log[log.length - 1]?.win;
    if (win && res.applied) {
      const saved = await savePlan(win, await listTasks());
      update((e) => ({ ...e, saved: cleanText(saved.message, { keepNewlines: false }) }));
    }
  };

  // Opened from "Plan my week" / "Pick my three": ask right away.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !params.preset || mode === 'busy') return;
    started.current = true;
    // A plan starts a new conversation (no earlier questions or pending changes mixed in).
    assistant.reset();
    setLog([]);
    setProposals([]);
    assistant
      .preset(params.preset)
      .then((q) => run(q))
      .catch((err) => notify(cleanText(String(err.message), { keepNewlines: false }), 'error'));
  }, [params.preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const discard = () => {
    assistant.discardProposals();
    setProposals([]);
    setMode('answered');
    notify('Discarded the proposed changes', 'info');
  };

  const last = log[log.length - 1];

  useViewInput(
    (input, key) => {
      if (mode === 'busy') {
        if (key.escape) ctl.current?.abort();
        return;
      }
      if (mode === 'blocked') {
        if (key.escape) return setMode(log.length ? 'answered' : 'input');
        if (input === 'c') {
          assistant.discardProposals();
          setProposals([]);
          return run(blocked.question, 'claude');
        }
        if (key.return) return run(blocked.question, 'local', { force: true });
        return;
      }
      if (mode === 'review') {
        if (key.escape) return setMode('answered');
        if (key.upArrow || input === 'k') return setPIndex((i) => Math.max(0, i - 1));
        if (key.downArrow || input === 'j') return setPIndex((i) => Math.min(proposals.length - 1, i + 1));
        if (input === ' ') return setProposals((ps) => ps.map((x, i) => (i === pIndex ? { ...x, keep: !x.keep } : x)));
        if (key.return) return apply();
        if (input === 'x') return discard();
        return;
      }
      if (mode === 'answered') {
        if (key.escape) return navigate('home');
        if (key.return) return setMode('input');
        if (input === 'c' && last) {
          // Claude answers the same question afresh: the local model's leftover proposals go.
          assistant.discardProposals();
          setProposals([]);
          return run(last.ask ?? last.q, 'claude');
        }
        if (input === 'n') {
          assistant.reset();
          setLog([]);
          setProposals([]);
          return setMode('input');
        }
        if (input === 'p' && proposals.length) return setMode('review');
        if (key.upArrow || input === 'k') return setScroll((s) => s + 1);
        if (key.downArrow || input === 'j') return setScroll((s) => Math.max(0, s - 1));
        return;
      }
      if (mode === 'input' && key.escape) return log.length ? setMode('answered') : navigate('home');
    },
    true
  );

  // The conversation as wrapped lines, newest at the bottom.
  const width = Math.max(30, columns - 6);
  const lines = useMemo(() => {
    const out = [];
    const wrap = (text, color, extra = {}) => {
      for (const ln of wrapAnsi(text, width, { hard: true, trim: false }).split('\n')) out.push({ text: ln, color, ...extra });
    };
    log.forEach((e, i) => {
      if (i) out.push({ text: '' });
      wrap(`› ${e.q}`, C.accent, { bold: true });
      for (const t of e.trace) wrap(`  · looked at ${t}`, C.muted);
      if (e.text) wrap(e.text.trim(), undefined);
      else if (!e.done) out.push({ text: '…', color: C.muted });
      if (e.error) wrap(e.error === 'stopped' ? '(stopped)' : `Couldn't answer: ${e.error}`, e.error === 'stopped' ? C.muted : C.danger);
      if (e.applied) out.push({ text: `✓ applied ${e.applied} change${e.applied === 1 ? '' : 's'} (u undoes)`, color: C.success });
      if (e.saved) out.push({ text: `  ${e.saved}`, color: C.muted });
      out.push({ text: `  ${e.provider === 'claude' ? 'Claude' : 'local'} · ${e.model}`, color: C.muted });
    });
    return out;
  }, [log, width]);

  const reviewRows = mode === 'review' ? proposals.length + 3 : 0;
  const inputRows = mode === 'input' || mode === 'blocked' ? 4 : 0;
  const room = Math.max(3, contentHeight - 3 - reviewRows - inputRows);
  const maxScroll = Math.max(0, lines.length - room);
  const off = Math.min(scroll, maxScroll);
  const shown = lines.slice(Math.max(0, lines.length - room - off), lines.length - off);

  const { model } = assistantSettings();
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color={C.accent}>Ask</Text>
        <Text color={C.muted}>  local {model} · c sends a question to Claude{off ? `  · ↑ ${off} more below` : ''}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {log.length ? (
          shown.map((l, i) => (
            <Text key={i} color={l.color} bold={l.bold} wrap="truncate-end">
              {l.text || ' '}
            </Text>
          ))
        ) : (
          <Text color={C.muted}>Ask about your tasks, routines, Log, focus time, library and lists, or ask for changes: it proposes them and you confirm.</Text>
        )}
      </Box>
      {mode === 'review' ? (
        <Box flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} marginTop={1}>
          <Text bold color={C.accent}>Proposed changes</Text>
          {proposals.map((x, i) => (
            <Text key={i} wrap="truncate-end">
              <Text color={C.accent}>{i === pIndex ? '› ' : '  '}</Text>
              <Text color={x.keep ? C.success : C.muted}>{x.keep ? '[✓] ' : '[ ] '}</Text>
              <Text color={x.keep ? undefined : C.muted}>{cleanText(x.p.label, { keepNewlines: false })}</Text>
            </Text>
          ))}
        </Box>
      ) : null}
      {mode === 'blocked' && blocked ? (
        <Box borderStyle="round" borderColor={C.soon} paddingX={1} marginTop={1}>
          <Text>
            Not loading the local model: {blocked.reason}. <Text bold>c</Text> ask Claude · <Text bold>enter</Text> run locally anyway · <Text bold>esc</Text> cancel
          </Text>
        </Box>
      ) : null}
      {mode === 'input' ? <AskInput onSubmit={(q) => run(q)} /> : null}
    </Box>
  );
}
