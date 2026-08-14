import { llmProvider } from '@/lib/llm-gateway';

/**
 * Conversation memory — Milestone 8 (AD-5).
 *
 * Never send the full history. Window the recent turns and maintain a persisted
 * summary (separate model call, stored, not recomputed per turn). Memory is
 * tenant- and conversation-scoped — the repository writes it with `forScope`,
 * and the engine never asks the model about another contact's data.
 */

export const MEMORY_WINDOW_TURNS = 8;

export type MemoryTurn = {
  role: 'customer' | 'agent' | 'ai';
  text: string;
  at: Date;
};

export type MemoryContext = {
  summary: string | null;
  recentTurns: MemoryTurn[];
};

/** Builds the windowed context: last N turns + the persisted summary. */
export function buildMemoryContext(
  summary: string | null,
  turns: MemoryTurn[],
): MemoryContext {
  return {
    summary,
    recentTurns: turns.slice(-MEMORY_WINDOW_TURNS),
  };
}

/** Renders the memory context into the compact form the prompt builder uses. */
export function renderMemory(context: MemoryContext): string {
  const parts: string[] = [];
  if (context.summary) parts.push(`Prior context: ${context.summary}`);
  for (const turn of context.recentTurns) {
    const role =
      turn.role === 'customer' ? 'Customer' : turn.role === 'ai' ? 'Assistant' : 'Agent';
    parts.push(`${role}: ${turn.text}`);
  }
  return parts.join('\n');
}

/**
 * Summarises a set of turns through the provider. The engine persists the result
 * via the repository (conversation_summaries, model "ai-engine") — it is NOT
 * recomputed on every turn.
 */
export async function summarizeTurns(turns: MemoryTurn[]): Promise<string> {
  const provider = llmProvider();
  const text = turns.map((t) => `${t.role}: ${t.text}`).join('\n');
  return provider.summarize({ turns: text.split('\n') });
}
