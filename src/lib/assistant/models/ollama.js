// The local model, through Ollama's /api/chat (http://127.0.0.1:11434).
// Kept light on the Mac: the model loads only when a question is asked,
// every request sets a short keep_alive so Ollama frees the memory soon
// after, the context window is capped, and `ollama serve` is started only
// when needed (and stopped again by whoever started it: see stopOllama).
import { spawn } from 'node:child_process';
import { getPref } from '../../prefs.js';
import { cleanText } from '../../sanitize.js';

export const DEFAULT_MODEL = 'qwen3.5:9b';

export function ollamaUrl() {
  return (process.env.MAGNUS_OLLAMA_URL || getPref('ollamaUrl', 'http://127.0.0.1:11434')).replace(/\/$/, '');
}

export function assistantSettings() {
  return {
    model: getPref('assistantModel', DEFAULT_MODEL),
    keepAlive: getPref('assistantKeepAlive', '2m'),
    numCtx: getPref('assistantContext', 8192),
  };
}

async function fetchJson(path, { body, timeout = 3000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`${ollamaUrl()}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(cleanText((await r.text()).slice(0, 200), { keepNewlines: false }) || r.statusText);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function ollamaUp() {
  try {
    await fetchJson('/api/version', { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

let started = null; // the `ollama serve` child, if this process started it
let callCounter = 0; // tool-call ids stay unique across a conversation (Claude requires it)

/** Start `ollama serve` if it isn't running. Resolves when it answers. */
export async function ensureOllama() {
  if (await ollamaUp()) return;
  if (process.env.MAGNUS_OLLAMA_URL) throw new Error(`no model server at ${ollamaUrl()}`);
  // Flash attention + an 8-bit KV cache roughly halve the context's memory (Homebrew's recommended settings).
  const env = { OLLAMA_FLASH_ATTENTION: '1', OLLAMA_KV_CACHE_TYPE: 'q8_0', ...process.env };
  started = spawn(getPref('ollamaCommand', 'ollama'), ['serve'], { stdio: 'ignore', detached: true, env });
  started.on('error', () => {});
  started.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await ollamaUp()) return;
  }
  throw new Error('Ollama did not start (is it installed? brew install ollama)');
}

/** Which models are loaded right now, with their memory size (bytes). */
export async function loadedModels() {
  try {
    return (await fetchJson('/api/ps')).models || [];
  } catch {
    return [];
  }
}

/** On-disk size of a model (bytes), roughly what loading it takes. */
export async function modelSize(model) {
  try {
    const { models = [] } = await fetchJson('/api/tags');
    return models.find((m) => m.name === model || m.model === model)?.size ?? null;
  } catch {
    return null;
  }
}

/** Free the model's memory now instead of waiting for keep_alive. */
export async function unloadModel(model = assistantSettings().model) {
  if (!(await ollamaUp())) return;
  if (!(await loadedModels()).some((m) => m.name === model || m.model === model)) return;
  await fetchJson('/api/generate', { body: { model, keep_alive: 0 }, timeout: 5000 }).catch(() => {});
}

/** Stop `ollama serve` if this process started it, unless something else needs it. */
export async function stopOllama({ keepIf = async () => false } = {}) {
  if (!started) return;
  const child = started;
  started = null;
  if (await keepIf()) return;
  try {
    process.kill(child.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

export function startedOllama() {
  return Boolean(started);
}

// ---------- chat ----------

// Neutral transcript → Ollama messages.
function toMessages(system, transcript) {
  const out = [{ role: 'system', content: system }];
  for (const m of transcript) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || '',
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })) } : {}),
      });
    } else if (m.role === 'tool') {
      for (const r of m.results) out.push({ role: 'tool', tool_name: r.name, content: r.content });
    }
  }
  return out;
}

export function ollamaModel(overrides = {}) {
  const settings = { ...assistantSettings(), ...overrides };
  return {
    provider: 'local',
    label: settings.model,
    /**
     * One model turn. Streams text through onText and resolves to
     * { text, toolCalls: [{ id, name, args }] }.
     */
    async chat(args) {
      try {
        return await this.turn(args, false);
      } catch (err) {
        // qwen3.5 sometimes writes a tool call Ollama can't parse when thinking
        // is off; with thinking on it comes out right (and isn't much slower).
        if (!/expected element type|tool call/i.test(String(err.message)) || args.signal?.aborted) throw err;
        args.onText?.(null, { discard: true });
        return this.turn(args, true);
      }
    },
    async turn({ system, transcript, tools, toolChoice, onText = () => {}, signal }, think) {
      if (toolChoice === 'none') tools = []; // Ollama has no tool_choice: just offer none
      const r = await fetch(`${ollamaUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: settings.model,
          messages: toMessages(system, transcript),
          tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
          stream: true,
          think,
          keep_alive: settings.keepAlive,
          options: { num_ctx: settings.numCtx, temperature: 0.2 },
        }),
      });
      if (!r.ok) {
        const msg = cleanText((await r.text()).slice(0, 200), { keepNewlines: false });
        throw new Error(/not found/i.test(msg) ? `model ${settings.model} isn't downloaded (ollama pull ${settings.model})` : msg || r.statusText);
      }
      let text = '';
      const toolCalls = [];
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(cleanText(String(chunk.error), { keepNewlines: false }));
          const msg = chunk.message || {};
          if (msg.content) {
            text += msg.content;
            onText(msg.content);
          }
          for (const c of msg.tool_calls || []) {
            let args = c.function?.arguments ?? {};
            if (typeof args === 'string') {
              try {
                args = JSON.parse(args);
              } catch {
                args = {};
              }
            }
            toolCalls.push({ id: `local_${++callCounter}`, name: c.function?.name, args });
          }
        }
      }
      return { text, toolCalls };
    },
  };
}
