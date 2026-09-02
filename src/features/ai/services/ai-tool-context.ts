import { type IntentResult } from '@/features/ai/services/classifier';
import {
  executeAuthorizedTool,
  knowledgeTool,
  TOOL_REGISTRY,
  type ToolDefinition,
} from '@/features/ai/services/tools/registry';
import type { RunCitation } from '@/features/ai/services/ai-run-recorder';
import type { Scope } from '@/lib/db/scope';

const KNOWLEDGE_TOOL = 'knowledge.lookup';
const SIMILARITY_CITATION_THRESHOLD = 0.5;

export type AiToolContext = {
  text: string;
  citations: RunCitation[];
  escalated: boolean;
};

export async function resolveAiToolContext(
  intent: IntentResult,
  messageText: string,
  scope: Scope,
  allowedTools?: ReadonlySet<string>,
): Promise<AiToolContext> {
  if (intent.label === 'complaint' || intent.label === 'human') {
    return { text: '', citations: [], escalated: true };
  }
  if (intent.label === 'booking' || intent.label === 'availability') {
    if (
      allowedTools &&
      !allowedTools.has('availability.slots') &&
      !allowedTools.has('appointment.book')
    ) {
      return { text: '', citations: [], escalated: false };
    }
    return {
      text: 'The customer asked about appointments. Offer to check availability or book a slot.',
      citations: [],
      escalated: false,
    };
  }

  if (allowedTools && !allowedTools.has(KNOWLEDGE_TOOL))
    return { text: '', citations: [], escalated: false };
  const result = await executeAuthorizedTool(
    KNOWLEDGE_TOOL,
    { query: messageText, limit: 3 },
    scope,
    new Set([KNOWLEDGE_TOOL]),
  );
  const hits = (
    result.data as {
      hits: { chunkId: string; content: string; similarity: number; source: string }[];
    }
  ).hits.filter((hit) => hit.similarity >= SIMILARITY_CITATION_THRESHOLD);

  return {
    text: hits.map((hit) => hit.content).join('\n'),
    citations: hits.slice(0, 3).map((hit) => ({
      chunkId: hit.chunkId,
      similarity: hit.similarity,
      content: hit.content,
    })),
    escalated: false,
  };
}

export function engineTools(allowed?: readonly string[]): ToolDefinition[] {
  if (!allowed) return [knowledgeTool];
  return allowed
    .map((name) => TOOL_REGISTRY[name])
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}
