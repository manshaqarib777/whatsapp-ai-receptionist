import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Quotes data access — Milestone 11.
 *
 * The only layer that touches the database for quote reads and writes. Every
 * query runs through `forScope(scope)` — the tenant isolation control — with the
 * scope built by `resolveScope` from the session-derived organization id.
 *
 * `Quote`, `QuoteLineItem`, `QuoteVersion`, and `QuoteTemplate` are BRANCH-scoped,
 * so writes need a branch scope. The repository holds the org-level scope for
 * reads and derives a branch scope (`writeScope`) for writes.
 *
 * Scoped-model rule: never `findUnique` on a scoped model — use `findFirst` +
 * `expectOne`. Cross-tenant reads/writes are 404, never 403.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type QuoteLineItemRow = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
};

export type QuoteRow = {
  id: string;
  number: string;
  contactId: string;
  contactName: string | null;
  dealId: string | null;
  templateId: string | null;
  status: QuoteStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  validUntil: Date | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineItems: QuoteLineItemRow[];
};

export type QuoteTemplateRow = {
  id: string;
  name: string;
  bodyTemplate: string;
  branding: { logoKey?: string | null; colors?: Record<string, string> | null; footer?: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteVersionRow = {
  id: string;
  versionNumber: number;
  snapshot: unknown;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const QUOTE_SELECT = {
  id: true,
  number: true,
  contactId: true,
  contact: { select: { displayName: true } },
  dealId: true,
  templateId: true,
  status: true,
  subtotalAmount: true,
  taxAmount: true,
  totalAmount: true,
  currency: true,
  validUntil: true,
  sentAt: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  lineItems: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      description: true,
      quantity: true,
      unitPriceAmount: true,
      taxRate: true,
      taxAmount: true,
      lineTotalAmount: true,
    },
  },
} as const;

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  bodyTemplate: true,
  branding: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class QuotationsRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): QuotationsRepository {
    return new QuotationsRepository(resolveScope(organizationId));
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
  // Quotes
  // -------------------------------------------------------------------------

  async listQuotes(filter: { status?: QuoteStatus } = {}): Promise<QuoteRow[]> {
    const rows = await this.db.quote.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: QUOTE_SELECT,
    });
    return rows.map(toQuoteRow);
  }

  async getQuote(id: string): Promise<QuoteRow> {
    const row = await this.db.quote.findFirst({
      where: { id, deletedAt: null },
      select: QUOTE_SELECT,
    });
    if (!row) throw new NotFoundError('Quote not found.');
    return toQuoteRow(row);
  }

  /** Next quote number — sequential per organization among non-deleted rows. */
  async nextQuoteNumber(): Promise<string> {
    const last = await this.db.quote.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    });
    const lastNumber = last?.number?.match(/^Q-(\d+)$/)?.[1];
    const next = lastNumber ? Number(lastNumber) + 1 : 1000;
    return `Q-${next}`;
  }

  async createQuote(input: {
    branchId: string;
    contactId: string;
    dealId?: string;
    templateId?: string;
    number: string;
    currency?: string;
    validUntil?: Date;
    lineItems: {
      description: string;
      quantity: number;
      unitPriceAmount: number;
      taxRate: number;
      taxAmount: number;
      lineTotalAmount: number;
    }[];
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
  }): Promise<QuoteRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.quote.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId,
        dealId: input.dealId ?? null,
        templateId: input.templateId ?? null,
        number: input.number,
        status: 'draft',
        currency: input.currency ?? 'SAR',
        validUntil: input.validUntil ?? null,
        subtotalAmount: input.subtotalAmount,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        lineItems: {
          create: input.lineItems.map((line, position) => ({
            organizationId: this.organizationId,
            position,
            description: line.description,
            quantity: line.quantity,
            unitPriceAmount: line.unitPriceAmount,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotalAmount: line.lineTotalAmount,
          })),
        },
      },
      select: QUOTE_SELECT,
    });
    // The scoped extension does not inject into nested writes; the line items
    // above carry organizationId explicitly, which the extension overwrites.
    return toQuoteRow(row);
  }

  async updateQuote(
    id: string,
    data: {
      contactId?: string;
      dealId?: string | null;
      templateId?: string | null;
      validUntil?: Date | null;
      currency?: string;
      subtotalAmount?: number;
      taxAmount?: number;
      totalAmount?: number;
    },
  ): Promise<QuoteRow> {
    const current = await this.getQuote(id);
    await expectOne(
      await this.db.quote.updateMany({
        where: { id, version: current.version },
        data: {
          ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
          ...(data.dealId !== undefined ? { dealId: data.dealId } : {}),
          ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
          ...(data.validUntil !== undefined ? { validUntil: data.validUntil } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.subtotalAmount !== undefined ? { subtotalAmount: data.subtotalAmount } : {}),
          ...(data.taxAmount !== undefined ? { taxAmount: data.taxAmount } : {}),
          ...(data.totalAmount !== undefined ? { totalAmount: data.totalAmount } : {}),
          version: { increment: 1 },
        },
      }),
      'Quote',
    );
    return this.getQuote(id);
  }

  async setQuoteStatus(
    id: string,
    status: QuoteStatus,
    extras: { sentAt?: Date; acceptedAt?: Date } = {},
  ): Promise<QuoteRow> {
    await this.db.quote.updateMany({
      where: { id },
      data: {
        status,
        ...(extras.sentAt ? { sentAt: extras.sentAt } : {}),
        ...(extras.acceptedAt ? { acceptedAt: extras.acceptedAt } : {}),
        version: { increment: 1 },
      },
    });
    return this.getQuote(id);
  }

  async replaceLineItems(
    quoteId: string,
    lines: {
      description: string;
      quantity: number;
      unitPriceAmount: number;
      taxRate: number;
      taxAmount: number;
      lineTotalAmount: number;
    }[],
  ): Promise<void> {
    const db = this.writeScope(await this.resolveDefaultBranch());
    await db.quoteLineItem.deleteMany({ where: { quoteId } });
    await db.quoteLineItem.createMany({
      data: lines.map((line, position) => ({
        organizationId: this.organizationId,
        quoteId,
        position,
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotalAmount: line.lineTotalAmount,
      })),
    });
  }

  async listVersions(quoteId: string): Promise<QuoteVersionRow[]> {
    const rows = await this.db.quoteVersion.findMany({
      where: { quoteId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, snapshot: true, createdAt: true },
    });
    return rows;
  }

  async createVersion(quoteId: string, versionNumber: number, snapshot: QuoteRow): Promise<void> {
    const db = this.writeScope(await this.resolveDefaultBranch());
    await db.quoteVersion.create({
      data: {
        organizationId: this.organizationId,
        quoteId,
        versionNumber,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      },
    });
  }

  async nextVersionNumber(quoteId: string): Promise<number> {
    const last = await this.db.quoteVersion.findFirst({
      where: { quoteId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async listTemplates(): Promise<QuoteTemplateRow[]> {
    const rows = await this.db.quoteTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: TEMPLATE_SELECT,
    });
    return rows.map((row) => ({ ...row, branding: row.branding as QuoteTemplateRow['branding'] }));
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

  // -------------------------------------------------------------------------
  // Existence checks
  // -------------------------------------------------------------------------

  async contactExists(id: string): Promise<boolean> {
    const row = await this.db.contact.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toQuoteRow(row: {
  id: string;
  number: string;
  contactId: string;
  contact: { displayName: string } | null;
  dealId: string | null;
  templateId: string | null;
  status: QuoteStatus;
  subtotalAmount: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  currency: string;
  validUntil: Date | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineItems: {
    id: string;
    position: number;
    description: string;
    quantity: unknown;
    unitPriceAmount: unknown;
    taxRate: unknown;
    taxAmount: unknown;
    lineTotalAmount: unknown;
  }[];
}): QuoteRow {
  return {
    id: row.id,
    number: row.number,
    contactId: row.contactId,
    contactName: row.contact?.displayName ?? null,
    dealId: row.dealId,
    templateId: row.templateId,
    status: row.status,
    subtotalAmount: Number(row.subtotalAmount),
    taxAmount: Number(row.taxAmount),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    validUntil: row.validUntil,
    sentAt: row.sentAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    lineItems: row.lineItems.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      quantity: Number(line.quantity),
      unitPriceAmount: Number(line.unitPriceAmount),
      taxRate: Number(line.taxRate),
      taxAmount: Number(line.taxAmount),
      lineTotalAmount: Number(line.lineTotalAmount),
    })),
  };
}
