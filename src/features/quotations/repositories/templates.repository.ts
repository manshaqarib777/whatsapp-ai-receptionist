import type { Scope } from '@/lib/db/scope';

import { QuotationsBaseRepository } from './quotations.base';
import type { QuoteTemplateRow } from './quotations.types';

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  bodyTemplate: true,
  branding: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Quote-template data access.
 *
 * Templates are branch-scoped and carry the branding (colors + footer) that
 * flows into the PDF.
 */
export class QuoteTemplatesRepository extends QuotationsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listTemplates(): Promise<QuoteTemplateRow[]> {
    const rows = await this.db.quoteTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: TEMPLATE_SELECT,
    });
    return rows.map((row) => ({
      ...row,
      branding: row.branding as QuoteTemplateRow['branding'],
    }));
  }

  async createTemplate(input: {
    branchId: string;
    name: string;
    bodyTemplate: string;
    branding?: QuoteTemplateRow['branding'];
  }): Promise<QuoteTemplateRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.quoteTemplate.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        bodyTemplate: input.bodyTemplate,
        branding: input.branding ?? undefined,
      },
      select: TEMPLATE_SELECT,
    });
    return { ...row, branding: row.branding as QuoteTemplateRow['branding'] };
  }
}
