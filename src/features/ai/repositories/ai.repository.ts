import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { NotFoundError } from '@/lib/errors';
import { resolveScope } from '@/server/scope';

/**
 * AI Engine data access — Milestone 8.
 *
 * The only layer that touches the database for AI reads and writes. Every query
 * runs through `forScope(scope)` — the tenant isolation control — with the scope
 * built by `resolveScope` from the session-derived organization id.
 *
 * `AiRun` and `PromptTemplate` are BRANCH-scoped, so writes need a branch scope.
 * The repository holds the org-level scope for reads and derives a branch scope
 * (`withBranch`) for writes — the branch always comes from the conversation or
 * the org's default branch, never from a request parameter.
 *
 * Scoped-model rule: never `findUnique` on a scoped model — use `findFirst` +
 * `expectOne`. Cross-tenant reads/writes are 404, never 403.
 */

export type AiRunRow = {
  id: string;
  conversationId: string | null;
  model: string;
  intent: string | null;
  confidence: number | null;
  inputTokens: number;
  outputTokens: number;
  costAmount: number;
  costCurrency: string;
  latencyMs: number;
  outcome: string;
  createdAt: Date;
};

export type PromptTemplateRow = {
  id: string;
  key: string;
  name: string;
  currentVersionId: string | null;
  version: number;
  createdAt: Date;
};

export type PromptTemplateDetail = PromptTemplateRow & {
  versions: {
    id: string;
    versionNumber: number;
    body: string;
    status: string;
    createdAt: Date;
  }[];
};

export type NewTemplateInput = {
  key: string;
  name: string;
  body: string;
  branchId?: string;
};

export class AiRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): AiRepository {
    return new AiRepository(resolveScope(organizationId));
  }

  /**
   * A branch-scoped write client. `AiRun`/`PromptTemplate` writes require the
   * branch to be resolved (the conversation's branch, or the default branch).
   */
  private writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

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

  async createRun(input: {
    branchId: string;
    conversationId: string | null;
    outputMessageId: string | null;
    promptVersionId: string | null;
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
    const row = await db.aiRun.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        conversationId: input.conversationId,
        outputMessageId: input.outputMessageId,
        promptVersionId: input.promptVersionId,
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
    return row;
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

  // -------------------------------------------------------------------------
  // Prompt templates
  // -------------------------------------------------------------------------

  async listTemplates(): Promise<PromptTemplateRow[]> {
    const rows = await this.db.promptTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async getTemplate(id: string): Promise<PromptTemplateDetail> {
    const row = await this.db.promptTemplate.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            body: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError('Template not found.');
    return row;
  }

  async findTemplateByKey(key: string): Promise<PromptTemplateDetail | null> {
    const row = await this.db.promptTemplate.findFirst({
      where: { key, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            body: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    return row;
  }

  async createTemplate(
    input: NewTemplateInput,
  ): Promise<{ id: string; versionId: string }> {
    const branchId = input.branchId ?? (await this.resolveDefaultBranch());
    const db = this.writeScope(branchId);
    const template = await db.promptTemplate.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        key: input.key,
        name: input.name,
        version: 1,
      },
      select: { id: true },
    });

    const version = await db.promptTemplateVersion.create({
      data: {
        organizationId: this.organizationId,
        templateId: template.id,
        versionNumber: 1,
        body: input.body,
        status: 'draft',
      },
      select: { id: true },
    });

    return { id: template.id, versionId: version.id };
  }

  async addVersion(
    templateId: string,
    body: string,
  ): Promise<{ versionId: string; versionNumber: number }> {
    const template = await this.getTemplate(templateId);
    const nextNumber = template.versions[0]?.versionNumber ?? 0;
    const versionNumber = nextNumber + 1;

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    const version = await db.promptTemplateVersion.create({
      data: {
        organizationId: this.organizationId,
        templateId,
        versionNumber,
        body,
        status: 'draft',
      },
      select: { id: true },
    });

    await this.db.promptTemplate.updateMany({
      where: { id: templateId },
      data: { version: versionNumber },
    });

    return { versionId: version.id, versionNumber };
  }

  async activateVersion(templateId: string, versionId: string): Promise<void> {
    const version = await this.db.promptTemplateVersion.findFirst({
      where: { templateId, id: versionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundError('Version not found.');

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    await db.$transaction([
      db.promptTemplateVersion.updateMany({
        where: { id: versionId },
        data: { status: 'active' },
      }),
      db.promptTemplate.updateMany({
        where: { id: templateId },
        data: { currentVersionId: versionId },
      }),
    ]);
  }

  /** Resolves the active body for a template key (engine read path). */
  async resolveActiveBody(key: string): Promise<string | null> {
    const template = await this.db.promptTemplate.findFirst({
      where: { key, deletedAt: null },
      select: {
        currentVersionId: true,
        versions: {
          where: { status: 'active' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    });
    if (!template?.currentVersionId) return null;
    const active = template.versions[0];
    if (!active) return null;
    return active.body;
  }

  async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}
