import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import type { Scope } from '@/lib/db/scope';

import { InvoicesBaseRepository } from './invoices.base';
import { toInvoiceRow } from './invoices.mappers';
import type { InvoiceRow, InvoiceStatus, QuoteForInvoice } from './invoices.types';

const INVOICE_SELECT = {
  id: true,
  number: true,
  contactId: true,
  contact: { select: { displayName: true } },
  quoteId: true,
  status: true,
  subtotalAmount: true,
  taxAmount: true,
  totalAmount: true,
  amountPaid: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  paidAt: true,
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
 * Invoice data access — CRUD, numbering, line items, and the quote link.
 *
 * Sequential per-organization numbering is a schema property: uniqueness per
 * organization means concurrent creates cannot collide.
 */
export class InvoicesAggregateRepository extends InvoicesBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listInvoices(filter: { status?: InvoiceStatus } = {}): Promise<InvoiceRow[]> {
    const rows = await this.db.invoice.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: INVOICE_SELECT,
    });
    return rows.map(toInvoiceRow);
  }

  async getInvoice(id: string): Promise<InvoiceRow> {
    const row = await this.db.invoice.findFirst({
      where: { id, deletedAt: null },
      select: INVOICE_SELECT,
    });
    if (!row) throw new NotFoundError('Invoice not found.');
    return toInvoiceRow(row);
  }

  /** Next invoice number — sequential per organization among non-deleted rows. */
  async nextInvoiceNumber(): Promise<string> {
    const last = await this.db.invoice.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    });
    const lastNumber = last?.number?.match(/^INV-(\d+)$/)?.[1];
    const next = lastNumber ? Number(lastNumber) + 1 : 1000;
    return `INV-${next}`;
  }

  async createInvoice(input: {
    branchId: string;
    contactId: string;
    quoteId?: string;
    number: string;
    currency?: string;
    dueAt?: Date;
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
  }): Promise<InvoiceRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.invoice.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId,
        quoteId: input.quoteId ?? null,
        number: input.number,
        status: 'draft',
        currency: input.currency ?? 'SAR',
        dueAt: input.dueAt ?? null,
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
      select: INVOICE_SELECT,
    });
    return toInvoiceRow(row);
  }

  async updateInvoice(
    id: string,
    data: {
      dueAt?: Date | null;
      currency?: string;
      subtotalAmount?: number;
      taxAmount?: number;
      totalAmount?: number;
    },
  ): Promise<InvoiceRow> {
    const current = await this.getInvoice(id);
    await expectOne(
      await this.db.invoice.updateMany({
        where: { id, version: current.version },
        data: {
          ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.subtotalAmount !== undefined
            ? { subtotalAmount: data.subtotalAmount }
            : {}),
          ...(data.taxAmount !== undefined ? { taxAmount: data.taxAmount } : {}),
          ...(data.totalAmount !== undefined ? { totalAmount: data.totalAmount } : {}),
          version: { increment: 1 },
        },
      }),
      'Invoice',
    );
    return this.getInvoice(id);
  }

  async setInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    extras: { issuedAt?: Date; paidAt?: Date } = {},
  ): Promise<InvoiceRow> {
    await this.db.invoice.updateMany({
      where: { id },
      data: {
        status,
        ...(extras.issuedAt ? { issuedAt: extras.issuedAt } : {}),
        ...(extras.paidAt ? { paidAt: extras.paidAt } : {}),
        version: { increment: 1 },
      },
    });
    return this.getInvoice(id);
  }

  /** Update only the paid amount (driven by payment reconciliation). */
  async setAmountPaid(id: string, amountPaid: number): Promise<void> {
    await this.db.invoice.updateMany({
      where: { id },
      data: { amountPaid, version: { increment: 1 } },
    });
  }

  async replaceLineItems(
    invoiceId: string,
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
    await db.invoiceLineItem.deleteMany({ where: { invoiceId } });
    await db.invoiceLineItem.createMany({
      data: lines.map((line, position) => ({
        organizationId: this.organizationId,
        invoiceId,
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

  /** True if any non-deleted invoice already links this quote. */
  async quoteAlreadyInvoiced(quoteId: string): Promise<boolean> {
    const row = await this.db.invoice.findFirst({
      where: { quoteId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  /** The quote in the narrow shape the invoice-from-quote flow needs. */
  async getQuoteForInvoice(id: string): Promise<QuoteForInvoice | null> {
    const row = await this.db.quote.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        contactId: true,
        currency: true,
        subtotalAmount: true,
        taxAmount: true,
        totalAmount: true,
        lineItems: {
          orderBy: { position: 'asc' },
          select: {
            description: true,
            quantity: true,
            unitPriceAmount: true,
            taxRate: true,
            taxAmount: true,
            lineTotalAmount: true,
          },
        },
      },
    });
    if (!row) return null;
    return {
      ...row,
      subtotalAmount: Number(row.subtotalAmount),
      taxAmount: Number(row.taxAmount),
      totalAmount: Number(row.totalAmount),
      lineItems: row.lineItems.map((line) => ({
        ...line,
        quantity: Number(line.quantity),
        unitPriceAmount: Number(line.unitPriceAmount),
        taxRate: Number(line.taxRate),
        taxAmount: Number(line.taxAmount),
        lineTotalAmount: Number(line.lineTotalAmount),
      })),
    };
  }
}
