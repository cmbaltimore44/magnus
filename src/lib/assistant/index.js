// One Ask Magnus conversation: the transcript, the toolbox (task refs and
// pending proposals) and the model behind each question. The TUI keeps one
// for the whole session (getAssistant), so leaving Ask and coming back keeps
// the conversation; `magnus ask` makes its own.
import { createToolbox } from './tools.js';
import { ask } from './loop.js';
import { applyProposals } from './apply.js';
import { ollamaModel, ensureOllama, loadedModels, unloadModel, stopOllama, assistantSettings } from './models/ollama.js';
import { claudeModel } from './models/claude.js';
import { canLoadLocalModel } from './resources.js';
import { tutorUp } from '../tutor.js';
import { weekQuestion, threeQuestion } from './plan.js';

export function createAssistant() {
  let toolbox = createToolbox();
  let transcript = [];
  let usedLocal = false;
  let checked = false; // the memory/battery check runs before the first load only

  return {
    get proposals() {
      return [...toolbox.proposals];
    },
    get hasConversation() {
      return transcript.length > 0;
    },

    /**
     * Get the local model ready. → { ok: true } or { ok: false, reason }
     * when the Mac is short on memory or battery (force skips the check).
     */
    async prepareLocal({ force = false } = {}) {
      const { model } = assistantSettings();
      const loaded = (await loadedModels()).some((m) => m.name === model || m.model === model); // e.g. Tutor already has it in memory
      if (!loaded && !checked && !force) {
        const res = await canLoadLocalModel();
        if (!res.ok) return res;
      }
      checked = true;
      await ensureOllama();
      return { ok: true };
    },

    /** provider: 'local' | 'claude'. Resolves to { answer, steps, provider, model }. */
    async ask(question, { provider = 'local', onText, onTrace, signal, maxSteps, planning = false } = {}) {
      const model = provider === 'claude' ? claudeModel() : ollamaModel();
      if (provider === 'local') usedLocal = true;
      toolbox.setPlanning(planning);
      try {
        const res = await ask({ question, model, toolbox, transcript, onText, onTrace, signal, ...(maxSteps ? { maxSteps } : {}) });
        return { ...res, provider, model: model.label };
      } finally {
        toolbox.setPlanning(false);
      }
    },

    /** A planning question with its data attached (plan.js): preset 'week' or 'three'. */
    async preset(kind, today) {
      return kind === 'week' ? weekQuestion(toolbox, today) : threeQuestion(toolbox, today);
    },

    /** Apply the chosen proposals; the rest are dropped. → { applied, error, restore } */
    async apply(userId, chosen) {
      const res = await applyProposals(userId, chosen);
      toolbox.clearProposals();
      return res;
    },

    discardProposals() {
      toolbox.clearProposals();
    },

    reset() {
      toolbox = createToolbox();
      transcript = [];
    },

    /** Free the local model's memory now (leaving Ask), unless Tutor is sharing it. */
    async release() {
      if (!usedLocal || (await tutorUp())) return;
      await unloadModel();
    },

    /** Free the model's memory now, and stop `ollama serve` if we started it (unless Tutor is up). */
    async close() {
      if (!usedLocal) return;
      if (await tutorUp()) return; // Tutor shares the model: keep_alive frees it once neither uses it
      await unloadModel();
      await stopOllama();
    },
  };
}

let shared = null;

export function getAssistant() {
  return (shared ??= createAssistant());
}

/** Called when Magnus quits. */
export async function closeAssistant() {
  if (shared) await shared.close().catch(() => {});
}
