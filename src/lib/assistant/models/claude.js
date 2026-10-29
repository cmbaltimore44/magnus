// Claude, for the questions you choose to send it (c in Ask, `magnus ask
// --claude`). The SDK is imported only when a question goes to Claude, so it
// costs nothing at startup. The API key lives in the Keychain (item
// `magnus-anthropic`, typed in Settings); without one, the SDK's own
// credentials (ANTHROPIC_API_KEY or an `ant auth login` profile) are used.
import { readSecret } from '../../keychain.js';
import { getPref } from '../../prefs.js';

export const CLAUDE_KEYCHAIN_SERVICE = 'magnus-anthropic';
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';

let client = null;
let Anthropic = null;

async function getClient() {
  if (client) return client;
  ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  const apiKey = process.env.MAGNUS_DEMO ? null : readSecret(CLAUDE_KEYCHAIN_SERVICE);
  client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  return client;
}

/** After the key changes in Settings: the next question builds a new client. */
export function resetClaudeClient() {
  client = null;
}

export function hasClaudeKey() {
  return Boolean(readSecret(CLAUDE_KEYCHAIN_SERVICE) || process.env.ANTHROPIC_API_KEY);
}

// Neutral transcript → Messages API messages. Claude's own turns are replayed
// exactly as they came back (thinking blocks included); turns the local model
// wrote become plain text + tool_use blocks.
function toMessages(transcript) {
  const out = [];
  for (const m of transcript) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      if (m.raw?.provider === 'claude') {
        out.push({ role: 'assistant', content: m.raw.content });
        continue;
      }
      const content = [];
      if (m.text?.trim()) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls || []) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args || {} });
      if (content.length) out.push({ role: 'assistant', content });
    } else if (m.role === 'tool') {
      out.push({ role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })) });
    }
  }
  return out;
}

function friendlyError(err) {
  if (!Anthropic) return err;
  if (err instanceof Anthropic.AuthenticationError) return new Error('Claude rejected the API key (Settings → Claude API key)');
  if (err instanceof Anthropic.PermissionDeniedError) return new Error("this API key can't use that model");
  if (err instanceof Anthropic.RateLimitError) return new Error('Claude is rate limiting this key; try again in a minute');
  if (err instanceof Anthropic.APIConnectionError) return new Error("can't reach the Claude API (offline?)");
  if (err instanceof Anthropic.APIError) return new Error(`Claude API error ${err.status ?? ''}: ${err.message}`.trim());
  if (/credentials|api key|apiKey/i.test(String(err.message))) return new Error('no Claude API key yet (add one in Settings, ,)');
  return err;
}

export function claudeModel(overrides = {}) {
  const model = overrides.model || getPref('assistantClaudeModel', DEFAULT_CLAUDE_MODEL);
  return {
    provider: 'claude',
    label: model,
    async chat({ system, transcript, tools, toolChoice, onText = () => {}, signal }) {
      try {
        const c = await getClient();
        const stream = c.beta.messages.stream(
          {
            model,
            max_tokens: 16000,
            system,
            messages: toMessages(transcript),
            ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
            ...(tools.length && toolChoice === 'none' ? { tool_choice: { type: 'none' } } : {}),
            // Short lookups and small edits: low effort keeps answers quick.
            output_config: { effort: getPref('assistantClaudeEffort', 'low') },
            // On a policy decline, the API retries on Anthropic's recommended fallback model.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { signal }
        );
        stream.on('text', (delta) => onText(delta));
        const message = await stream.finalMessage();
        if (message.stop_reason === 'refusal') throw new Error('Claude declined to answer this one');
        if (message.stop_reason === 'max_tokens') throw new Error('Claude ran out of room for the answer');
        const blocks = message.content;
        const text = blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('');
        const toolCalls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} }));
        return { text, toolCalls, raw: { provider: 'claude', content: blocks } };
      } catch (err) {
        throw friendlyError(err);
      }
    },
  };
}
