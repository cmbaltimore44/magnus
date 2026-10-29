// The Ask Magnus loop: question → model turns with tool calls → answer.
// Provider-neutral: a model is anything with chat({ system, transcript,
// tools, onText, signal }) → { text, toolCalls } (models/ollama.js,
// models/claude.js). The transcript uses neutral messages:
//   { role: 'user', text }
//   { role: 'assistant', text, toolCalls: [{ id, name, args }] }
//   { role: 'tool', results: [{ id, name, content }] }
// Nothing is written here: write tools only add proposals to the toolbox.
import { todayISO, addDays } from '../data/completions.js';
import { cleanText } from '../sanitize.js';

export const MAX_STEPS = 6;

function dayName(iso, style = 'short') {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: style });
}

export function systemPrompt(now = new Date()) {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((d) => `${dayName(d)} ${d}`);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return [
    "You are Magnus, the user's personal assistant inside their task and habit tracker.",
    `Today is ${dayName(today, 'long')} ${today}, ${time} (${zone}). The next seven days: ${days.join(', ')}.`,
    '',
    'How to work:',
    "- Look things up with the tools before answering. Never guess the user's data.",
    '- To change anything, call add_task, update_task or log. Those only PROPOSE changes: the user reviews and confirms them after your answer. A change exists only if you called one of those tools: never describe a change you did not make a tool call for. After calling them, say "I\'ve proposed …", never that something is done.',
    '- update_task needs a ref (t1, t2, …) from find_tasks or upcoming, so look the task up first. One call per task.',
    '- Use exact dates (YYYY-MM-DD) from the calendar above when the user names a day.',
    '- Refer to tasks by their title, never by ref.',
    '- Answer briefly: a sentence or two, or a short list with "- " bullets. Plain text, no headings, tables or bold.',
  ].join('\n');
}

// One line per tool call for the "looked at" trace.
export function describeCall(name, args = {}) {
  switch (name) {
    case 'find_tasks': {
      const bits = [args.status && args.status !== 'open' ? args.status : null, args.due && args.due !== 'any' ? `due ${args.due.replace('_', ' ')}` : null, args.starred ? 'starred' : null, args.category ? `#${args.category}` : null, args.text ? `“${args.text}”` : null].filter(Boolean);
      return `tasks${bits.length ? ` (${bits.join(', ')})` : ''}`;
    }
    case 'upcoming':
      return 'upcoming';
    case 'routines':
      return `routines${args.date ? ` on ${args.date}` : ''}`;
    case 'projects':
      return 'projects';
    case 'log_history':
      return `the Log (${args.days || 14} days)`;
    case 'focus_summary':
      return `focus time (${args.days || 7} days)`;
    case 'library':
      return `the library${args.status && args.status !== 'all' ? ` (${args.status.replace(/_/g, ' ')})` : ''}`;
    case 'lists':
      return args.name ? `the ${args.name} list` : 'lists';
    default:
      return null; // write tools show up as proposals instead
  }
}

/**
 * Ask one question. `transcript` (the conversation so far) is extended in
 * place, so a follow-up continues it. Resolves to { answer, steps }.
 */
// A model that says it changed something without calling a write tool.
const CLAIMS_CHANGE = /\b(i(?:'ve| have)? (?:proposed|added|moved|logged|marked|starred|unstarred|rescheduled|updated|changed|set))\b/i;
const NUDGE = 'You have not called add_task, update_task or log, so nothing was proposed. Make those tool calls now (look tasks up first if you need refs), then answer.';

// Local models sometimes emit a tool call Ollama can't parse; a retry
// usually comes out clean.
async function chatWithRetry(model, args) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await model.chat(args);
    } catch (err) {
      if (attempt >= 3 || args.signal?.aborted || !/expected element type|parse|unexpected (?:end|token)/i.test(String(err.message))) throw err;
      args.onText(null, { discard: true });
    }
  }
}

export async function ask({ question, model, toolbox, transcript = [], onText = () => {}, onTrace = () => {}, signal, maxSteps = MAX_STEPS, now = new Date() }) {
  toolbox.fresh();
  transcript.push({ role: 'user', text: question });
  const system = systemPrompt(now);
  const proposalsBefore = toolbox.proposals.length;
  let nudged = false;
  for (let step = 1; step <= maxSteps; step++) {
    // Text streamed before a tool call is usually "let me check…": show only
    // the turn that ends without tool calls as the answer.
    let streamed = '';
    const { text, toolCalls, raw } = await chatWithRetry(model, {
      system,
      transcript,
      tools: toolbox.defs,
      signal,
      onText: (chunk, info = {}) => {
        if (chunk) streamed += chunk;
        onText(chunk, { step, ...info });
      },
    });
    transcript.push({ role: 'assistant', text, toolCalls, ...(raw ? { raw } : {}) });
    if (!toolCalls.length) {
      if (!nudged && toolbox.proposals.length === proposalsBefore && CLAIMS_CHANGE.test(text)) {
        nudged = true;
        if (streamed) onText(null, { step, discard: true });
        transcript.push({ role: 'user', text: NUDGE });
        continue;
      }
      return { answer: text.trim(), steps: step };
    }
    if (streamed) onText(null, { step, discard: true });
    const results = [];
    for (const call of toolCalls) {
      const line = describeCall(call.name, call.args);
      // Tool arguments are model output (and can echo injected text): no control sequences.
      if (line) onTrace(cleanText(line, { keepNewlines: false }));
      const { result } = await toolbox.run(call.name, call.args);
      results.push({ id: call.id, name: call.name, content: result });
    }
    transcript.push({ role: 'tool', results });
  }
  // Out of steps: ask for an answer from what it has, with no more tools.
  // The tools stay defined (the Messages API needs them when the history has
  // tool calls), but the model may not call one: toolChoice 'none'.
  const { text } = await chatWithRetry(model, {
    system,
    transcript: [...transcript, { role: 'user', text: 'Answer now from what you found, without more tools.' }],
    tools: toolbox.defs,
    toolChoice: 'none',
    signal,
    onText: (c, info = {}) => onText(c, { step: maxSteps + 1, ...info }),
  });
  transcript.push({ role: 'assistant', text, toolCalls: [] });
  return { answer: text.trim(), steps: maxSteps + 1 };
}
