import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { AiBaseRepository } from './ai.base';
import type { AiRunRow } from './ai.types';

/**
 * AI run + citation data access.
 *
 * Runs record every model call per conversation — intent, confidence, token
 * usage, cost, latency, and outcome — with citations to knowledge chunks.
 */
export class AiRunsRepository extends AiBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listRuns(conversationId?: string, limit = 20): Promise<AiRunRow[]> {
    const rows = await this.db.aiRun.findMany({
      where: conversationId ? { conversationId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        model: true,
        intent: true,
        confidence: true,
        inputTokens: true,
        outputTokens: true,
        costAmount: true,
        costCurrency: true,
        latencyMs: true,
        outcome: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      ...row,
      confidence: row.confidence === null ? null : Number(row.confidence),
      costAmount: Number(row.costAmount),
    }));
  }

  async getRun(
    id: string,
  ): Promise<
    AiRunRow & { citations: { chunkId: string; similarity: number; content: string }[] }
  > {
    const row = await this.db.aiRun.findFirst({
      where: { id },
      select: {
        id: true,
        conversationId: true,
        model: true,
        intent: true,
        confidence: true,
        inputTokens: true,
        outputTokens: true,
        costAmount: true,
        costCurrency: true,
        latencyMs: true,
        outcome: true,
        createdAt: true,
        citations: {
          select: {
            knowledgeChunkId: true,
            similarity: true,
            knowledgeChunk: { select: { content: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundError('Run not found.');
    return {
      ...row,
      confidence: row.confidence === null ? null : Number(row.confidence),
      costAmount: Number(row.costAmount),
      citations: row.citations.map((c) => ({
        chunkId: c.knowledgeChunkId,
        similarity: Number(c.similarity),
        content: c.knowledgeChunk.content,
      })),
    };
  }

  async findRun(id: string): Promise<{ id: string } | null> {
    return this.db.aiRun.findFirst({ where: { id }, select: { id: true } });
  }

  async createRun(input: {
    id?: string;
    branchId: string;
    conversationId: string | null;
    outputMessageId: string | null;
    promptVersionId: string | null;
    agentId?: string | null;
    model: string;
    intent: string | null;
    confidence: number | null;
    inputTokens: number;
    outputTokens: number;
    costAmount: number;
    costCurrency: string;
    latencyMs: number;
    outcome: string;
  }): Promise<{ id: string }> {
    const db = this.writeScope(input.branchId);
    return db.aiRun.create({
      data: {
        id: input.id,
        organizationId: this.organizationId,
        branchId: input.branchId,
        conversationId: input.conversationId,
        outputMessageId: input.outputMessageId,
        promptVersionId: input.promptVersionId,
        agentId: input.agentId ?? null,
        model: input.model,
        intent: input.intent,
        confidence: input.confidence,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costAmount: input.costAmount,
        costCurrency: input.costCurrency,
        latencyMs: input.latencyMs,
        outcome: input.outcome as 'answered' | 'escalated' | 'refused' | 'failed',
      },
      select: { id: true },
    });
  }

  async createCitations(
    aiRunId: string,
    citations: { knowledgeChunkId: string; similarity: number }[],
    branchId: string,
  ): Promise<void> {
    if (citations.length === 0) return;
    const db = this.writeScope(branchId);
    await db.aiRunCitation.createMany({
      data: citations.map((c) => ({
        organizationId: this.organizationId,
        aiRunId,
        knowledgeChunkId: c.knowledgeChunkId,
        similarity: c.similarity,
      })),
    });
  }
}
