import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * CRM data access — Milestone 10.
 *
 * The only layer that touches the database for CRM reads and writes. Every query
 * runs through `forScope(scope)` — the tenant isolation control — with the scope
 * built by `resolveScope` from the session-derived organization id.
 *
 * `Pipeline`, `PipelineStage`, `Deal`, `Company`, `Tag`, `Taggable`, `Activity`,
 * and `Task` are BRANCH-scoped, so writes need a branch scope. The repository
 * holds the org-level scope for reads and derives a branch scope (`writeScope`)
 * for writes — the branch always comes from the session's active branch
 * resolution, never from a request parameter.
 *
 * Scoped-model rule: never `findUnique` on a scoped model — use `findFirst` +
 * `expectOne`. Cross-tenant reads/writes are 404, never 403.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealStatus = 'open' | 'won' | 'lost';
export type TaggableType = 'contact' | 'deal' | 'conversation';
export type ActivityKind =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'stage_change'
  | 'status_change'
  | 'assigned'
  | 'unassigned'
  | 'label_changed'
  | 'archived';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type PipelineRow = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageRow[];
};

export type PipelineStageRow = {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  winProbability: number;
  dealCount: number;
};

export type DealRow = {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stageName: string;
  title: string;
  valueAmount: number;
  valueCurrency: string;
  status: DealStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  contactName: string | null;
  companyName: string | null;
  tags: { id: string; name: string; color: string }[];
};

export type CompanyRow = {
  id: string;
  name: string;
  vatNumber: string | null;
  createdAt: Date;
  contactCount: number;
  dealCount: number;
};

export type CompanyDetail = CompanyRow & {
  contacts: { id: string; displayName: string; phoneNumber: string }[];
  deals: { id: string; title: string; status: DealStatus; valueAmount: number }[];
};

export type TagRow = {
  id: string;
  name: string;
  color: string;
};

export type ActivityRow = {
  id: string;
  subjectType: TaggableType;
  subjectId: string;
  kind: ActivityKind;
  body: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const PIPELINE_SELECT = {
  id: true,
  name: true,
  isDefault: true,
  stages: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, position: true, winProbability: true },
  },
} as const;

const TAG_SELECT = {
  id: true,
  name: true,
  color: true,
} as const;

const DEAL_SELECT = {
  id: true,
  contactId: true,
  companyId: true,
  stageId: true,
  stage: { select: { name: true } },
  title: true,
  valueAmount: true,
  valueCurrency: true,
  status: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  contact: { select: { displayName: true } },
  company: { select: { name: true } },
} as const;

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  status: true,
  assignee: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CrmRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): CrmRepository {
    return new CrmRepository(resolveScope(organizationId));
  }

  private writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }

  // -------------------------------------------------------------------------
  // Pipelines + stages
  // -------------------------------------------------------------------------

  async listPipelines(): Promise<PipelineRow[]> {
    const rows = await this.db.pipeline.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: PIPELINE_SELECT,
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        isDefault: row.isDefault,
        stages: await Promise.all(
          row.stages.map(async (stage) => ({
            id: stage.id,
            pipelineId: row.id,
            name: stage.name,
            position: stage.position,
            winProbability: Number(stage.winProbability),
            dealCount: await this.countDealsInStage(stage.id),
          })),
        ),
      })),
    );
  }

  async getDefaultPipeline(): Promise<PipelineRow> {
    const row = await this.db.pipeline.findFirst({
      where: { deletedAt: null, isDefault: true },
      select: PIPELINE_SELECT,
    });
    if (!row) throw new NotFoundError('No default pipeline for this organization.');
    return this.toPipelineRow(row);
  }

  async createPipeline(input: {
    branchId: string;
    name: string;
    stages: { name: string; winProbability?: number }[];
  }): Promise<PipelineRow> {
    const db = this.writeScope(input.branchId);
    const pipeline = await db.pipeline.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        isDefault: false,
      },
      select: { id: true },
    });

    await db.pipelineStage.createMany({
      data: input.stages.map((stage, position) => ({
        organizationId: this.organizationId,
        pipelineId: pipeline.id,
        name: stage.name,
        position,
        winProbability: stage.winProbability ?? 0,
      })),
    });

    return this.getPipelineById(pipeline.id);
  }

  async getPipelineById(id: string): Promise<PipelineRow> {
    const row = await this.db.pipeline.findFirst({
      where: { id, deletedAt: null },
      select: PIPELINE_SELECT,
    });
    if (!row) throw new NotFoundError('Pipeline not found.');
    return this.toPipelineRow(row);
  }

  private async toPipelineRow(row: {
    id: string;
    name: string;
    isDefault: boolean;
    stages: { id: string; name: string; position: number; winProbability: unknown }[];
  }): Promise<PipelineRow> {
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      stages: await Promise.all(
        row.stages.map(async (stage) => ({
          id: stage.id,
          pipelineId: row.id,
          name: stage.name,
          position: stage.position,
          winProbability: Number(stage.winProbability),
          dealCount: await this.countDealsInStage(stage.id),
        })),
      ),
    };
  }

  async getStage(stageId: string): Promise<{ id: string; pipelineId: string; name: string }> {
    const row = await this.db.pipelineStage.findFirst({
      where: { id: stageId, deletedAt: null },
      select: { id: true, pipelineId: true, name: true },
    });
    if (!row) throw new NotFoundError('Stage not found.');
    return row;
  }

  async countDealsInStage(stageId: string): Promise<number> {
    return this.db.deal.count({ where: { stageId, status: 'open', deletedAt: null } });
  }

  // -------------------------------------------------------------------------
  // Deals
  // -------------------------------------------------------------------------

  async listDeals(filter: {
    stageId?: string;
    status?: DealStatus;
  }): Promise<DealRow[]> {
    const rows = await this.db.deal.findMany({
      where: {
        deletedAt: null,
        ...(filter.stageId ? { stageId: filter.stageId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: DEAL_SELECT,
    });
    const deals = rows.map(toDealRow);
    const ids = deals.map((d) => d.id);
    const tagsByDeal = await this.tagsForDeals(ids);
    for (const deal of deals) {
      deal.tags = tagsByDeal.get(deal.id) ?? [];
    }
    return deals;
  }

  async getDeal(id: string): Promise<DealRow> {
    const row = await this.db.deal.findFirst({
      where: { id, deletedAt: null },
      select: DEAL_SELECT,
    });
    if (!row) throw new NotFoundError('Deal not found.');
    const deal = toDealRow(row);
    deal.tags = await this.tagsForDeal(id);
    return deal;
  }

  async createDeal(input: {
    branchId: string;
    contactId?: string;
    companyId?: string;
    stageId: string;
    title: string;
    valueAmount?: number;
    valueCurrency?: string;
  }): Promise<DealRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.deal.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        stageId: input.stageId,
        title: input.title,
        valueAmount: input.valueAmount ?? 0,
        valueCurrency: input.valueCurrency ?? 'SAR',
        status: 'open',
      },
      select: DEAL_SELECT,
    });
    const deal = toDealRow(row);
    deal.tags = await this.tagsForDeal(row.id);
    return deal;
  }

  async updateDeal(
    id: string,
    data: {
      title?: string;
      valueAmount?: number;
      valueCurrency?: string;
      contactId?: string | null;
      companyId?: string | null;
    },
  ): Promise<DealRow> {
    const current = await this.getDeal(id);
    await expectOne(
      await this.db.deal.updateMany({
        where: { id, version: current.version },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.valueAmount !== undefined ? { valueAmount: data.valueAmount } : {}),
          ...(data.valueCurrency !== undefined ? { valueCurrency: data.valueCurrency } : {}),
          ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
          ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
          version: { increment: 1 },
        },
      }),
      'Deal',
    );
    return this.getDeal(id);
  }

  async moveDealToStage(id: string, stageId: string): Promise<DealRow> {
    await this.getStage(stageId);
    await this.db.deal.updateMany({
      where: { id },
      data: { stageId, version: { increment: 1 } },
    });
    return this.getDeal(id);
  }

  async closeDeal(id: string, status: 'won' | 'lost'): Promise<DealRow> {
    await this.db.deal.updateMany({
      where: { id, status: 'open' },
      data: { status, closedAt: new Date(), version: { increment: 1 } },
    });
    return this.getDeal(id);
  }

  /** Recent open deals, for the automation worker to evaluate. */
  async listRecentDeals(since: Date): Promise<DealRow[]> {
    const rows = await this.db.deal.findMany({
      where: { deletedAt: null, status: 'open', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: DEAL_SELECT,
    });
    const deals = rows.map(toDealRow);
    const tagsByDeal = await this.tagsForDeals(deals.map((d) => d.id));
    for (const deal of deals) {
      deal.tags = tagsByDeal.get(deal.id) ?? [];
    }
    return deals;
  }

  /** Recent companies, for the automation worker to evaluate. */
  async listRecentCompanies(since: Date): Promise<{ id: string; name: string }[]> {
    return this.db.company.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true },
    });
  }

  /** Tags for one deal. */
  private async tagsForDeal(dealId: string): Promise<DealRow['tags']> {
    return (await this.tagsForDeals([dealId])).get(dealId) ?? [];
  }

  /** Tags for many deals, keyed by deal id — one query, not one per deal. */
  private async tagsForDeals(dealIds: string[]): Promise<Map<string, DealRow['tags']>> {
    if (dealIds.length === 0) return new Map();
    const rows = await this.db.taggable.findMany({
      where: { taggableType: 'deal', taggableId: { in: dealIds } },
      select: {
        taggableId: true,
        tag: { select: { id: true, name: true, color: true } },
      },
    });
    const byDeal = new Map<string, DealRow['tags']>();
    for (const row of rows) {
      const list = byDeal.get(row.taggableId) ?? [];
      list.push(row.tag);
      byDeal.set(row.taggableId, list);
    }
    return byDeal;
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  async listCompanies(): Promise<CompanyRow[]> {
    const rows = await this.db.company.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        vatNumber: true,
        createdAt: true,
        contacts: { where: { deletedAt: null }, select: { id: true } },
        deals: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber,
      createdAt: row.createdAt,
      contactCount: row.contacts.length,
      dealCount: row.deals.length,
    }));
  }

  async getCompany(id: string): Promise<CompanyDetail> {
    const row = await this.db.company.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        vatNumber: true,
        createdAt: true,
        contacts: {
          where: { deletedAt: null },
          select: { id: true, displayName: true, phoneNumber: true },
        },
        deals: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, valueAmount: true },
        },
      },
    });
    if (!row) throw new NotFoundError('Company not found.');
    return {
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber,
      createdAt: row.createdAt,
      contactCount: row.contacts.length,
      dealCount: row.deals.length,
      contacts: row.contacts,
      deals: row.deals.map((deal) => ({
        ...deal,
        valueAmount: Number(deal.valueAmount),
      })),
    };
  }

  async createCompany(input: {
    branchId: string;
    name: string;
    vatNumber?: string;
  }): Promise<CompanyRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.company.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        vatNumber: input.vatNumber ?? null,
      },
      select: { id: true, name: true, vatNumber: true, createdAt: true },
    });
    return { ...row, contactCount: 0, dealCount: 0 };
  }

  async updateCompany(
    id: string,
    data: { name?: string; vatNumber?: string | null },
  ): Promise<CompanyRow> {
    await expectOne(
      await this.db.company.updateMany({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.vatNumber !== undefined ? { vatNumber: data.vatNumber } : {}),
          version: { increment: 1 },
        },
      }),
      'Company',
    );
    return this.getCompany(id);
  }

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  async listTags(): Promise<TagRow[]> {
    const rows = await this.db.tag.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: TAG_SELECT,
    });
    return rows;
  }

  async createTag(input: { branchId: string; name: string; color: string }): Promise<TagRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.tag.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        color: input.color,
      },
      select: TAG_SELECT,
    });
    return row;
  }

  async getTag(id: string): Promise<TagRow> {
    const row = await this.db.tag.findFirst({
      where: { id, deletedAt: null },
      select: TAG_SELECT,
    });
    if (!row) throw new NotFoundError('Tag not found.');
    return row;
  }

  /**
   * Tags a subject. Idempotent — the unique `(tagId, taggableType, taggableId)`
   * constraint means re-tagging is a no-op, not a duplicate.
   */
  async assignTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<void> {
    await this.getTag(tagId);
    try {
      await this.db.taggable.create({
        data: {
          organizationId: this.organizationId,
          tagId,
          taggableType,
          taggableId,
        },
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') return; // already tagged — idempotent
      throw error;
    }
  }

  async removeTag(tagId: string, taggableType: TaggableType, taggableId: string): Promise<void> {
    await this.db.taggable.deleteMany({
      where: { tagId, taggableType, taggableId },
    });
  }

  async listTaggedDeals(tagId: string): Promise<string[]> {
    const rows = await this.db.taggable.findMany({
      where: { tagId, taggableType: 'deal' },
      select: { taggableId: true },
    });
    return rows.map((row) => row.taggableId);
  }

  /**
   * Finds a tag by name, creating it (in the default branch) when absent. Used
   * by automation rules so a configured tag name does not need a manual setup
   * step.
   */
  async findOrCreateTagByName(name: string): Promise<TagRow> {
    const existing = await this.db.tag.findFirst({
      where: { name, deletedAt: null },
      select: TAG_SELECT,
    });
    if (existing) return existing;

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    const created = await db.tag.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        name,
        color: 'neutral',
      },
      select: TAG_SELECT,
    });
    return created;
  }

  /** Idempotency marker: has this subject already had this kind of activity? */
  async hasActivityOfKind(
    subjectId: string,
    subjectType: TaggableType,
    kind: ActivityKind,
  ): Promise<boolean> {
    const row = await this.db.activity.findFirst({
      where: { subjectId, subjectType, kind },
      select: { id: true },
    });
    return row !== null;
  }

  /** Idempotency marker: is this tag already on this subject? */
  async hasTag(tagId: string, taggableType: TaggableType, taggableId: string): Promise<boolean> {
    const row = await this.db.taggable.findFirst({
      where: { tagId, taggableType, taggableId },
      select: { id: true },
    });
    return row !== null;
  }

  // -------------------------------------------------------------------------
  // Activities
  // -------------------------------------------------------------------------

  async listActivities(subjectType: TaggableType, subjectId: string): Promise<ActivityRow[]> {
    const rows = await this.db.activity.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        kind: true,
        body: true,
        actor: { select: { name: true } },
        createdAt: true,
      },
    });
    return rows.map(({ actor, ...row }) => ({
      ...row,
      actorName: actor?.name ?? null,
    }));
  }

  async createActivity(input: {
    branchId: string;
    subjectType: TaggableType;
    subjectId: string;
    kind: ActivityKind;
    body?: string;
    actorId?: string | null;
  }): Promise<ActivityRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.activity.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        kind: input.kind,
        body: input.body ?? null,
        actorId: input.actorId ?? null,
      },
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        kind: true,
        body: true,
        actor: { select: { name: true } },
        createdAt: true,
      },
    });
    const { actor, ...rest } = row;
    return { ...rest, actorName: actor?.name ?? null };
  }

  // -------------------------------------------------------------------------
  // Cross-entity existence checks (for tagging/activity subjects)
  // -------------------------------------------------------------------------

  async contactExists(id: string): Promise<boolean> {
    const row = await this.db.contact.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  async conversationExists(id: string): Promise<boolean> {
    const row = await this.db.conversation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async listTasks(filter: { status?: TaskStatus }): Promise<TaskRow[]> {
    const rows = await this.db.task.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: TASK_SELECT,
    });
    return rows.map(toTaskRow);
  }

  async createTask(input: {
    branchId: string;
    title: string;
    description?: string;
    dueAt?: string;
    assigneeId?: string;
  }): Promise<TaskRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.task.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        assigneeId: input.assigneeId ?? null,
      },
      select: TASK_SELECT,
    });
    return toTaskRow(row);
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<TaskRow> {
    await this.db.task.updateMany({
      where: { id },
      data: { status, version: { increment: 1 } },
    });
    const row = await this.db.task.findFirst({ where: { id }, select: TASK_SELECT });
    if (!row) throw new NotFoundError('Task not found.');
    return toTaskRow(row);
  }

  async listAssignableUsers(): Promise<{ id: string; name: string }[]> {
    const rows = await this.db.member.findMany({
      where: { organizationId: this.organizationId },
      select: { user: { select: { id: true, name: true } } },
    });
    return rows.map((row) => ({ id: row.user.id, name: row.user.name }));
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toDealRow(row: {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stage: { name: string };
  title: string;
  valueAmount: unknown;
  valueCurrency: string;
  status: DealStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  contact: { displayName: string } | null;
  company: { name: string } | null;
}): DealRow {
  return {
    id: row.id,
    contactId: row.contactId,
    companyId: row.companyId,
    stageId: row.stageId,
    stageName: row.stage.name,
    title: row.title,
    valueAmount: Number(row.valueAmount),
    valueCurrency: row.valueCurrency,
    status: row.status,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    contactName: row.contact?.displayName ?? null,
    companyName: row.company?.name ?? null,
    tags: [],
  };
}

function toTaskRow(row: {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  assignee: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    status: row.status,
    assigneeName: row.assignee?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
