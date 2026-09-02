import type { AiAgentKind } from './agents.types';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { AiBaseRepository } from './ai.base';

const SELECT = {
  id: true,
  kind: true,
  displayName: true,
  description: true,
  enabled: true,
  promptTemplateId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class AiAgentsRepository extends AiBaseRepository {
  list() {
    return this.db.aiAgent.findMany({ select: SELECT, orderBy: { kind: 'asc' } });
  }
  async get(id: string) {
    const row = await this.db.aiAgent.findFirst({ where: { id }, select: SELECT });
    if (!row) throw new NotFoundError('AI agent not found.');
    return row;
  }
  findEnabled() {
    return this.db.aiAgent.findMany({ where: { enabled: true }, select: SELECT });
  }
  async update(
    id: string,
    input: {
      displayName?: string;
      description?: string;
      enabled?: boolean;
      promptTemplateId?: string | null;
      version: number;
    },
  ) {
    await this.get(id);
    if (input.promptTemplateId) {
      const prompt = await this.db.promptTemplate.findFirst({
        where: { id: input.promptTemplateId },
        select: { id: true },
      });
      if (!prompt) throw new NotFoundError('Prompt template not found.');
    }
    const { version, ...changes } = input;
    const result = await this.db.aiAgent.updateMany({
      where: { id, version },
      data: { ...changes, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictError('The AI agent changed. Refresh and try again.');
    return this.get(id);
  }
  findByKind(kind: AiAgentKind) {
    return this.db.aiAgent.findFirst({ where: { kind, enabled: true }, select: SELECT });
  }
}
