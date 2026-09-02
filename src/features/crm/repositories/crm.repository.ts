import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { CrmPipelinesRepository } from './pipelines.repository';
import { CrmDealsRepository } from './deals.repository';
import { CrmCompaniesRepository } from './companies.repository';
import { CrmTagsRepository } from './tags.repository';
import { CrmActivitiesRepository } from './activities.repository';
import { CrmTasksRepository } from './tasks.repository';
import { CrmExistenceRepository } from './existence.repository';

/**
 * CRM data access facade — Milestone 10.
 *
 * The aggregate repositories (pipelines, deals, companies, tags, activities,
 * tasks, existence) each own one slice of the CRM database and stay under the
 * 300-line architecture rule. This facade composes them behind the single
 * `CrmRepository` surface the service and worker consume, so call sites do not
 * change and the tenant-isolation contract lives in `CrmBaseRepository`.
 */

export class CrmRepository {
  readonly organizationId: string;
  readonly pipelines: CrmPipelinesRepository;
  readonly deals: CrmDealsRepository;
  readonly companies: CrmCompaniesRepository;
  readonly tags: CrmTagsRepository;
  readonly activities: CrmActivitiesRepository;
  readonly tasks: CrmTasksRepository;
  readonly existence: CrmExistenceRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.pipelines = new CrmPipelinesRepository(scope);
    this.deals = new CrmDealsRepository(scope);
    this.companies = new CrmCompaniesRepository(scope);
    this.tags = new CrmTagsRepository(scope);
    this.activities = new CrmActivitiesRepository(scope);
    this.tasks = new CrmTasksRepository(scope);
    this.existence = new CrmExistenceRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): CrmRepository {
    return new CrmRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.pipelines.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Pipelines + stages
  // -------------------------------------------------------------------------

  listPipelines(): ReturnType<CrmPipelinesRepository['listPipelines']> {
    return this.pipelines.listPipelines();
  }

  getDefaultPipeline(): ReturnType<CrmPipelinesRepository['getDefaultPipeline']> {
    return this.pipelines.getDefaultPipeline();
  }

  createPipeline(
    input: Parameters<CrmPipelinesRepository['createPipeline']>[0],
  ): ReturnType<CrmPipelinesRepository['createPipeline']> {
    return this.pipelines.createPipeline(input);
  }

  getPipelineById(id: string): ReturnType<CrmPipelinesRepository['getPipelineById']> {
    return this.pipelines.getPipelineById(id);
  }

  getStage(stageId: string): ReturnType<CrmPipelinesRepository['getStage']> {
    return this.pipelines.getStage(stageId);
  }

  countDealsInStage(
    stageId: string,
  ): ReturnType<CrmPipelinesRepository['countDealsInStage']> {
    return this.pipelines.countDealsInStage(stageId);
  }

  // -------------------------------------------------------------------------
  // Deals
  // -------------------------------------------------------------------------

  listDeals(
    filter: Parameters<CrmDealsRepository['listDeals']>[0],
  ): ReturnType<CrmDealsRepository['listDeals']> {
    return this.deals.listDeals(filter);
  }

  getDeal(id: string): ReturnType<CrmDealsRepository['getDeal']> {
    return this.deals.getDeal(id);
  }

  createDeal(
    input: Parameters<CrmDealsRepository['createDeal']>[0],
  ): ReturnType<CrmDealsRepository['createDeal']> {
    return this.deals.createDeal(input);
  }

  updateDeal(
    id: string,
    data: Parameters<CrmDealsRepository['updateDeal']>[1],
  ): ReturnType<CrmDealsRepository['updateDeal']> {
    return this.deals.updateDeal(id, data);
  }

  moveDealToStage(
    id: string,
    stageId: string,
  ): ReturnType<CrmDealsRepository['moveDealToStage']> {
    return this.deals.moveDealToStage(id, stageId);
  }

  closeDeal(
    id: string,
    status: 'won' | 'lost',
  ): ReturnType<CrmDealsRepository['closeDeal']> {
    return this.deals.closeDeal(id, status);
  }

  listRecentDeals(since: Date): ReturnType<CrmDealsRepository['listRecentDeals']> {
    return this.deals.listRecentDeals(since);
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  listCompanies(): ReturnType<CrmCompaniesRepository['listCompanies']> {
    return this.companies.listCompanies();
  }

  getCompany(id: string): ReturnType<CrmCompaniesRepository['getCompany']> {
    return this.companies.getCompany(id);
  }

  createCompany(
    input: Parameters<CrmCompaniesRepository['createCompany']>[0],
  ): ReturnType<CrmCompaniesRepository['createCompany']> {
    return this.companies.createCompany(input);
  }

  updateCompany(
    id: string,
    data: Parameters<CrmCompaniesRepository['updateCompany']>[1],
  ): ReturnType<CrmCompaniesRepository['updateCompany']> {
    return this.companies.updateCompany(id, data);
  }

  listRecentCompanies(
    since: Date,
  ): ReturnType<CrmCompaniesRepository['listRecentCompanies']> {
    return this.companies.listRecentCompanies(since);
  }

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  listTags(): ReturnType<CrmTagsRepository['listTags']> {
    return this.tags.listTags();
  }

  createTag(
    input: Parameters<CrmTagsRepository['createTag']>[0],
  ): ReturnType<CrmTagsRepository['createTag']> {
    return this.tags.createTag(input);
  }

  getTag(id: string): ReturnType<CrmTagsRepository['getTag']> {
    return this.tags.getTag(id);
  }

  assignTag(
    tagId: string,
    taggableType: Parameters<CrmTagsRepository['assignTag']>[1],
    taggableId: string,
  ): ReturnType<CrmTagsRepository['assignTag']> {
    return this.tags.assignTag(tagId, taggableType, taggableId);
  }

  removeTag(
    tagId: string,
    taggableType: Parameters<CrmTagsRepository['removeTag']>[1],
    taggableId: string,
  ): ReturnType<CrmTagsRepository['removeTag']> {
    return this.tags.removeTag(tagId, taggableType, taggableId);
  }

  listTaggedDeals(tagId: string): ReturnType<CrmTagsRepository['listTaggedDeals']> {
    return this.tags.listTaggedDeals(tagId);
  }

  findOrCreateTagByName(
    name: string,
  ): ReturnType<CrmTagsRepository['findOrCreateTagByName']> {
    return this.tags.findOrCreateTagByName(name);
  }

  hasTag(
    tagId: string,
    taggableType: Parameters<CrmTagsRepository['hasTag']>[1],
    taggableId: string,
  ): ReturnType<CrmTagsRepository['hasTag']> {
    return this.tags.hasTag(tagId, taggableType, taggableId);
  }

  // -------------------------------------------------------------------------
  // Activities
  // -------------------------------------------------------------------------

  listActivities(
    subjectType: Parameters<CrmActivitiesRepository['listActivities']>[0],
    subjectId: string,
  ): ReturnType<CrmActivitiesRepository['listActivities']> {
    return this.activities.listActivities(subjectType, subjectId);
  }

  createActivity(
    input: Parameters<CrmActivitiesRepository['createActivity']>[0],
  ): ReturnType<CrmActivitiesRepository['createActivity']> {
    return this.activities.createActivity(input);
  }

  hasActivityOfKind(
    subjectId: string,
    subjectType: Parameters<CrmActivitiesRepository['hasActivityOfKind']>[1],
    kind: Parameters<CrmActivitiesRepository['hasActivityOfKind']>[2],
  ): ReturnType<CrmActivitiesRepository['hasActivityOfKind']> {
    return this.activities.hasActivityOfKind(subjectId, subjectType, kind);
  }

  // -------------------------------------------------------------------------
  // Cross-entity existence checks
  // -------------------------------------------------------------------------

  contactExists(id: string): ReturnType<CrmExistenceRepository['contactExists']> {
    return this.existence.contactExists(id);
  }

  conversationExists(
    id: string,
  ): ReturnType<CrmExistenceRepository['conversationExists']> {
    return this.existence.conversationExists(id);
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  listTasks(
    filter: Parameters<CrmTasksRepository['listTasks']>[0],
  ): ReturnType<CrmTasksRepository['listTasks']> {
    return this.tasks.listTasks(filter);
  }

  createTask(
    input: Parameters<CrmTasksRepository['createTask']>[0],
  ): ReturnType<CrmTasksRepository['createTask']> {
    return this.tasks.createTask(input);
  }

  updateTaskStatus(
    id: string,
    status: Parameters<CrmTasksRepository['updateTaskStatus']>[1],
  ): ReturnType<CrmTasksRepository['updateTaskStatus']> {
    return this.tasks.updateTaskStatus(id, status);
  }

  listAssignableUsers(): ReturnType<CrmTasksRepository['listAssignableUsers']> {
    return this.tasks.listAssignableUsers();
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  ActivityKind,
  ActivityRow,
  CompanyDetail,
  CompanyRow,
  DealRow,
  DealStatus,
  PipelineRow,
  PipelineStageRow,
  TagRow,
  TaggableType,
  TaskRow,
  TaskStatus,
} from './crm.types';
