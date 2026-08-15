import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { AiRunsRepository } from './runs.repository';
import { AiTemplatesRepository } from './templates.repository';

/**
 * AI-engine data access facade — Milestone 8.
 *
 * The aggregate repositories (runs, templates) each own one slice of the AI
 * database and stay under the 300-line architecture rule. This facade composes
 * them behind the single `AiRepository` surface the engine service consumes.
 */

export class AiRepository {
  readonly organizationId: string;
  readonly runs: AiRunsRepository;
  readonly templates: AiTemplatesRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.runs = new AiRunsRepository(scope);
    this.templates = new AiTemplatesRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): AiRepository {
    return new AiRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.runs.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  listRuns(
    conversationId?: string,
    limit?: number,
  ): ReturnType<AiRunsRepository['listRuns']> {
    return this.runs.listRuns(conversationId, limit);
  }

  getRun(id: string): ReturnType<AiRunsRepository['getRun']> {
    return this.runs.getRun(id);
  }

  createRun(
    input: Parameters<AiRunsRepository['createRun']>[0],
  ): ReturnType<AiRunsRepository['createRun']> {
    return this.runs.createRun(input);
  }

  createCitations(
    aiRunId: string,
    citations: Parameters<AiRunsRepository['createCitations']>[1],
    branchId: string,
  ): ReturnType<AiRunsRepository['createCitations']> {
    return this.runs.createCitations(aiRunId, citations, branchId);
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  listTemplates(): ReturnType<AiTemplatesRepository['listTemplates']> {
    return this.templates.listTemplates();
  }

  getTemplate(id: string): ReturnType<AiTemplatesRepository['getTemplate']> {
    return this.templates.getTemplate(id);
  }

  findTemplateByKey(key: string): ReturnType<AiTemplatesRepository['findTemplateByKey']> {
    return this.templates.findTemplateByKey(key);
  }

  createTemplate(
    input: Parameters<AiTemplatesRepository['createTemplate']>[0],
  ): ReturnType<AiTemplatesRepository['createTemplate']> {
    return this.templates.createTemplate(input);
  }

  addVersion(
    templateId: string,
    body: string,
  ): ReturnType<AiTemplatesRepository['addVersion']> {
    return this.templates.addVersion(templateId, body);
  }

  activateVersion(
    templateId: string,
    versionId: string,
  ): ReturnType<AiTemplatesRepository['activateVersion']> {
    return this.templates.activateVersion(templateId, versionId);
  }

  resolveActiveBody(key: string): ReturnType<AiTemplatesRepository['resolveActiveBody']> {
    return this.templates.resolveActiveBody(key);
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  AiRunRow,
  NewTemplateInput,
  PromptTemplateDetail,
  PromptTemplateRow,
} from './ai.types';
