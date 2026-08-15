import {
  CrmRepository,
  type ActivityKind,
  type ActivityRow,
  type CompanyDetail,
  type CompanyRow,
  type DealRow,
  type DealStatus,
  type PipelineRow,
  type TagRow,
  type TaggableType,
  type TaskRow,
  type TaskStatus,
} from '@/features/crm/repositories/crm.repository';
import { ConflictError, NotFoundError, UnprocessableError } from '@/lib/errors';

/**
 * CRM orchestration — Milestone 10.
 *
 * Pure orchestration over the repository: pipelines, the deal lifecycle (move
 * stage, close), companies, tags (polymorphic, idempotent), activities (one
 * `recordActivity` seam), and tasks. Every mutation on a deal/company/contact
 * records an `Activity` row so the timeline is real.
 */

export type Actor = { id: string } | null;

export class CrmService {
  private readonly repo: CrmRepository;
  readonly organizationId: string;

  constructor(repo: CrmRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): CrmService {
    return new CrmService(CrmRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Pipelines
  // -------------------------------------------------------------------------

  async listPipelines(): Promise<PipelineRow[]> {
    return this.repo.listPipelines();
  }

  async createPipeline(input: {
    name: string;
    stages: { name: string; winProbability?: number }[];
  }): Promise<PipelineRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    if (input.stages.length < 2) {
      throw new UnprocessableError('A pipeline needs at least two stages.');
    }
    return this.repo.createPipeline({ branchId, ...input });
  }

  // -------------------------------------------------------------------------
  // Deals — the core lifecycle
  // -------------------------------------------------------------------------

  async listDeals(
    filter: { stageId?: string; status?: DealStatus } = {},
  ): Promise<DealRow[]> {
    return this.repo.listDeals(filter);
  }

  async getDeal(id: string): Promise<DealRow> {
    return this.repo.getDeal(id);
  }

  async createDeal(input: {
    title: string;
    stageId: string;
    contactId?: string;
    companyId?: string;
    valueAmount?: number;
    valueCurrency?: string;
  }): Promise<DealRow> {
    // A deal must belong to a pipeline this org owns.
    await this.repo.getStage(input.stageId);
    const branchId = await this.repo.resolveDefaultBranch();
    const deal = await this.repo.createDeal({ branchId, ...input });
    await this.recordActivity(deal.id, 'deal', 'note', {
      body: `Deal created: ${deal.title}`,
      actor: null,
    });
    return deal;
  }

  async updateDeal(
    id: string,
    input: {
      title?: string;
      valueAmount?: number;
      valueCurrency?: string;
      contactId?: string | null;
      companyId?: string | null;
    },
  ): Promise<DealRow> {
    const deal = await this.repo.updateDeal(id, input);
    if (input.title && input.title !== deal.title) {
      await this.recordActivity(id, 'deal', 'note', {
        body: `Title changed to ${deal.title}`,
        actor: null,
      });
    }
    return deal;
  }

  async moveDealToStage(id: string, stageId: string): Promise<DealRow> {
    const deal = await this.repo.getDeal(id);
    if (deal.status !== 'open') {
      throw new ConflictError('A closed deal cannot be moved between stages.');
    }
    const stage = await this.repo.getStage(stageId);
    if (deal.stageId === stageId) return deal;

    const updated = await this.repo.moveDealToStage(id, stageId);
    await this.recordActivity(id, 'deal', 'stage_change', {
      body: `Moved from ${deal.stageName} to ${stage.name}`,
      actor: null,
    });
    return updated;
  }

  async closeDeal(id: string, status: 'won' | 'lost'): Promise<DealRow> {
    const deal = await this.repo.getDeal(id);
    if (deal.status !== 'open') {
      throw new ConflictError('This deal is already closed.');
    }
    const updated = await this.repo.closeDeal(id, status);
    await this.recordActivity(id, 'deal', 'status_change', {
      body: `Deal marked ${status}`,
      actor: null,
    });
    return updated;
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  async listCompanies(): Promise<CompanyRow[]> {
    return this.repo.listCompanies();
  }

  async getCompany(id: string): Promise<CompanyDetail> {
    return this.repo.getCompany(id);
  }

  async createCompany(input: { name: string; vatNumber?: string }): Promise<CompanyRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    const company = await this.repo.createCompany({ branchId, ...input });
    await this.recordActivity(company.id, 'contact', 'note', {
      body: `Company created: ${company.name}`,
      actor: null,
    });
    return company;
  }

  async updateCompany(
    id: string,
    input: { name?: string; vatNumber?: string | null },
  ): Promise<CompanyRow> {
    return this.repo.updateCompany(id, input);
  }

  // -------------------------------------------------------------------------
  // Tags — polymorphic and idempotent
  // -------------------------------------------------------------------------

  async listTags(): Promise<TagRow[]> {
    return this.repo.listTags();
  }

  async createTag(input: { name: string; color: string }): Promise<TagRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createTag({ branchId, ...input });
  }

  async assignTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<void> {
    // The subject must exist in this org before it can be tagged.
    await this.assertSubjectExists(taggableType, taggableId);
    await this.repo.assignTag(tagId, taggableType, taggableId);
  }

  async removeTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<void> {
    await this.repo.removeTag(tagId, taggableType, taggableId);
  }

  private async assertSubjectExists(type: TaggableType, id: string): Promise<void> {
    if (type === 'deal') {
      await this.repo.getDeal(id);
    } else if (type === 'contact') {
      const exists = await this.repo.contactExists(id);
      if (!exists) throw new NotFoundError('Contact not found.');
    } else {
      const exists = await this.repo.conversationExists(id);
      if (!exists) throw new NotFoundError('Conversation not found.');
    }
  }

  // -------------------------------------------------------------------------
  // Activities — the single recording seam
  // -------------------------------------------------------------------------

  async listActivities(
    subjectType: TaggableType,
    subjectId: string,
  ): Promise<ActivityRow[]> {
    return this.repo.listActivities(subjectType, subjectId);
  }

  async addActivity(
    subjectType: TaggableType,
    subjectId: string,
    input: { kind: 'note' | 'call' | 'email' | 'meeting'; body: string },
  ): Promise<ActivityRow> {
    await this.assertSubjectExists(subjectType, subjectId);
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createActivity({
      branchId,
      subjectType,
      subjectId,
      kind: input.kind,
      body: input.body,
      actorId: null,
    });
  }

  /**
   * The one place activities are written from the service layer. Every mutation
   * path (create/move/close/tag/task) funnels through here so the timeline is
   * complete rather than incidentally recorded.
   */
  async recordActivity(
    subjectId: string,
    subjectType: TaggableType,
    kind: ActivityKind,
    input: { body?: string; actor: Actor },
  ): Promise<void> {
    const branchId = await this.repo.resolveDefaultBranch();
    await this.repo.createActivity({
      branchId,
      subjectType,
      subjectId,
      kind,
      body: input.body,
      actorId: input.actor?.id,
    });
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async listTasks(filter: { status?: TaskStatus } = {}): Promise<TaskRow[]> {
    return this.repo.listTasks(filter);
  }

  async createTask(input: {
    title: string;
    description?: string;
    dueAt?: string;
    assigneeId?: string;
  }): Promise<TaskRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createTask({ branchId, ...input });
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<TaskRow> {
    return this.repo.updateTaskStatus(id, status);
  }

  async listAssignableUsers(): Promise<{ id: string; name: string }[]> {
    return this.repo.listAssignableUsers();
  }
}
