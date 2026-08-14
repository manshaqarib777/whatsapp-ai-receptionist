import {
  AiRepository,
  type NewTemplateInput,
  type PromptTemplateDetail,
  type PromptTemplateRow,
} from '@/features/ai/repositories/ai.repository';

/**
 * AI template orchestration — Milestone 8 (AD-6).
 *
 * Thin service over the repository: template CRUD and version activation. The
 * engine's `resolveActiveBody` path reads through the same repository.
 */

export class AiService {
  private readonly repo: AiRepository;

  constructor(repo: AiRepository) {
    this.repo = repo;
  }

  static forOrganization(organizationId: string): AiService {
    return new AiService(AiRepository.forOrganization(organizationId));
  }

  async listTemplates(): Promise<PromptTemplateRow[]> {
    return this.repo.listTemplates();
  }

  async getTemplate(id: string): Promise<PromptTemplateDetail> {
    return this.repo.getTemplate(id);
  }

  async createTemplate(
    input: NewTemplateInput,
  ): Promise<{ id: string; versionId: string }> {
    return this.repo.createTemplate(input);
  }

  async addVersion(
    templateId: string,
    body: string,
  ): Promise<{ versionId: string; versionNumber: number }> {
    return this.repo.addVersion(templateId, body);
  }

  async activateVersion(templateId: string, versionId: string): Promise<void> {
    return this.repo.activateVersion(templateId, versionId);
  }
}
