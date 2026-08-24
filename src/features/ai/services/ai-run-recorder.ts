import type { IntentResult } from '@/features/ai/services/classifier';
import type { AiRepository } from '@/features/ai/repositories/ai.repository';
import { currentReplyModel } from '@/lib/llm-gateway';

export type RecordedOutcome = 'answered' | 'escalated' | 'refused' | 'failed';
export type RunCitation = { chunkId: string; similarity: number; content: string };

export class AiRunRecorder {
  constructor(private readonly repo: AiRepository) {}

  async persist(input: {
    branchId: string;
    conversationId: string;
    intent: IntentResult;
    outcome: RecordedOutcome;
    citations: RunCitation[];
    latencyMs: number;
    tokens: { input: number; output: number };
    requestedRunId?: string;
    agentId?: string | null;
  }): Promise<string> {
    const run = await this.repo.createRun({
      id: input.requestedRunId,
      branchId: input.branchId,
      conversationId: input.conversationId,
      outputMessageId: null,
      promptVersionId: null,
      agentId: input.agentId ?? null,
      model: currentReplyModel(),
      intent: input.intent.label,
      confidence: input.intent.confidence,
      inputTokens: input.tokens.input,
      outputTokens: input.tokens.output,
      costAmount: estimateCost(input.tokens),
      costCurrency: 'USD',
      latencyMs: input.latencyMs,
      outcome: input.outcome,
    });

    if (input.citations.length > 0) {
      await this.repo.createCitations(
        run.id,
        input.citations.map((citation) => ({
          knowledgeChunkId: citation.chunkId,
          similarity: citation.similarity,
        })),
        input.branchId,
      );
    }

    return run.id;
  }
}

function estimateCost(tokens: { input: number; output: number }): number {
  return (tokens.input * 3 + tokens.output * 15) / 1_000_000;
}
