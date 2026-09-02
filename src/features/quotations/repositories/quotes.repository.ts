import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import type { Scope } from '@/lib/db/scope';

import { QuotationsBaseRepository } from './quotations.base';
import type { QuoteRow, QuoteStatus } from './quotations.types';

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

/**
 * Quote + version data access.
 *
 * Quotes are branch-scoped. Sequential per-organization numbering is a schema
 * property. Sending snapshots a `QuoteVersion` so the accepted/rejected
 * document is recoverable verbatim.
 */
export class QuotesRepository extends QuotationsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

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
          ...(data.subtotalAmount !== undefined
            ? { subtotalAmount: data.subtotalAmount }
            : {}),
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
}

export function toQuoteRow(row: {
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
