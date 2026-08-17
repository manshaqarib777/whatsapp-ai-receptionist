import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { BroadcastBaseRepository } from './broadcast.base';
import type { TemplateRow } from './broadcast.types';

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  language: true,
  metaStatus: true,
  rejectionReason: true,
  body: true,
  createdAt: true,
} as const;

/**
 * WhatsApp message-template data access.
 *
 * Templates are branch-scoped and unique per `(branchId, name, language)`.
 * A campaign can only use an `approved` template — the Meta approval status
 * gates use.
 */
export class TemplatesRepository extends BroadcastBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listTemplates(): Promise<TemplateRow[]> {
    return this.db.whatsappMessageTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: TEMPLATE_SELECT,
    });
  }

  async getTemplate(id: string): Promise<TemplateRow> {
    const row = await this.db.whatsappMessageTemplate.findFirst({
      where: { id, deletedAt: null },
      select: TEMPLATE_SELECT,
    });
    if (!row) throw new NotFoundError('Template not found.');
    return row;
  }

  async createTemplate(input: {
    branchId: string;
    name: string;
    language: string;
    body: unknown;
  }): Promise<TemplateRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.whatsappMessageTemplate.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        language: input.language,
        body: input.body as never,
        metaStatus: 'approved',
      },
      select: TEMPLATE_SELECT,
    });
    return row;
  }
}
