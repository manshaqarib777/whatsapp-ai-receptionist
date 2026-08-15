import {
  QuotationsRepository,
  type QuoteRow,
  type QuoteStatus,
  type QuoteTemplateRow,
} from '@/features/quotations/repositories/quotations.repository';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Quotes orchestration — Milestone 11.
 *
 * Pure orchestration over the repository: quote creation with VAT math,
 * sequential numbering, the status lifecycle (draft → sent → accepted/rejected,
 * expiry), line-item edits that bump a version snapshot, and templates.
 *
 * Money math: the tax RATE and tax AMOUNT are both stored per line at write time.
 * Nothing is recomputed from today's rate at read time — Saudi VAT moved 5% → 15%
 * in 2020, and a historical document must not silently change.
 */

/** Saudi VAT as of 2020. Stored as a fraction, matching the schema's CHECK. */
export const DEFAULT_VAT_RATE = 0.15;

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate?: number;
};

export type QuoteTotals = {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
};

/**
 * Pure VAT math for a set of lines. Each line's tax is rounded to 4 decimal
 * places (the schema's scale), and the totals are the sum of the rounded lines —
 * so the printed document always ties to the stored column values.
 */
export function computeTotals(lines: QuoteLineInput[]): QuoteTotals {
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const unit = line.unitPriceAmount;
    const quantity = line.quantity;
    const rate = line.taxRate ?? DEFAULT_VAT_RATE;
    const lineSubtotal = round4(unit * quantity);
    const lineTax = round4(lineSubtotal * rate);
    subtotal = round4(subtotal + lineSubtotal);
    tax = round4(tax + lineTax);
  }
  return {
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: round4(subtotal + tax),
  };
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export class QuotationsService {
  private readonly repo: QuotationsRepository;
  readonly organizationId: string;

  constructor(repo: QuotationsRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): QuotationsService {
    return new QuotationsService(QuotationsRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Quotes
  // -------------------------------------------------------------------------

  async listQuotes(filter: { status?: QuoteStatus } = {}): Promise<QuoteRow[]> {
    return this.repo.listQuotes(filter);
  }

  async getQuote(id: string): Promise<QuoteRow> {
    return this.repo.getQuote(id);
  }

  async createQuote(input: {
    contactId: string;
    dealId?: string;
    templateId?: string;
    currency?: string;
    validUntil?: string;
    lineItems: QuoteLineInput[];
  }): Promise<QuoteRow> {
    if (!(await this.repo.contactExists(input.contactId))) {
      throw new UnprocessableError('Contact not found.');
    }
    const branchId = await this.repo.resolveDefaultBranch();
    const number = await this.repo.nextQuoteNumber();
    const totals = computeTotals(input.lineItems);

    return this.repo.createQuote({
      branchId,
      contactId: input.contactId,
      dealId: input.dealId,
      templateId: input.templateId,
      number,
      currency: input.currency,
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      lineItems: input.lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        taxRate: line.taxRate ?? DEFAULT_VAT_RATE,
        taxAmount: round4(
          round4(line.unitPriceAmount * line.quantity) *
            (line.taxRate ?? DEFAULT_VAT_RATE),
        ),
        lineTotalAmount: round4(
          round4(line.unitPriceAmount * line.quantity) *
            (1 + (line.taxRate ?? DEFAULT_VAT_RATE)),
        ),
      })),
      subtotalAmount: totals.subtotalAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
    });
  }

  async updateQuote(
    id: string,
    input: {
      contactId?: string;
      dealId?: string | null;
      templateId?: string | null;
      validUntil?: string | null;
      currency?: string;
      lineItems?: QuoteLineInput[];
    },
  ): Promise<QuoteRow> {
    const quote = await this.repo.getQuote(id);
    if (quote.status !== 'draft') {
      throw new ConflictError(
        'Only a draft quote can be edited. Revise from a new draft instead.',
      );
    }

    if (input.lineItems) {
      const totals = computeTotals(input.lineItems);
      await this.repo.updateQuote(id, {
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.dealId !== undefined ? { dealId: input.dealId } : {}),
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.validUntil !== undefined
          ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
      });
      await this.repo.replaceLineItems(
        id,
        input.lineItems.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPriceAmount: line.unitPriceAmount,
          taxRate: line.taxRate ?? DEFAULT_VAT_RATE,
          taxAmount: round4(
            round4(line.unitPriceAmount * line.quantity) *
              (line.taxRate ?? DEFAULT_VAT_RATE),
          ),
          lineTotalAmount: round4(
            round4(line.unitPriceAmount * line.quantity) *
              (1 + (line.taxRate ?? DEFAULT_VAT_RATE)),
          ),
        })),
      );
      // Re-read so the returned row carries the replaced line items.
      return this.repo.getQuote(id);
    }

    return this.repo.updateQuote(id, {
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.dealId !== undefined ? { dealId: input.dealId } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.validUntil !== undefined
        ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    });
  }

  /**
   * Status transitions. `send` snapshots the current quote to a version first,
   * so the accepted/rejected document is the exact one the customer saw.
   */
  async transition(
    id: string,
    action: 'send' | 'accept' | 'reject' | 'expire' | 'mark_draft',
  ): Promise<QuoteRow> {
    const quote = await this.repo.getQuote(id);
    const now = new Date();

    switch (action) {
      case 'send': {
        if (quote.status === 'sent' || quote.status === 'accepted') {
          throw new ConflictError('This quote is already sent or accepted.');
        }
        const versionNumber = await this.repo.nextVersionNumber(id);
        await this.repo.createVersion(id, versionNumber, quote);
        return this.repo.setQuoteStatus(id, 'sent', { sentAt: now });
      }
      case 'accept': {
        if (quote.status !== 'sent') {
          throw new ConflictError('Only a sent quote can be accepted.');
        }
        return this.repo.setQuoteStatus(id, 'accepted', { acceptedAt: now });
      }
      case 'reject': {
        if (quote.status !== 'sent') {
          throw new ConflictError('Only a sent quote can be rejected.');
        }
        return this.repo.setQuoteStatus(id, 'rejected');
      }
      case 'expire': {
        if (quote.status !== 'sent') {
          throw new ConflictError('Only a sent quote can expire.');
        }
        return this.repo.setQuoteStatus(id, 'expired');
      }
      case 'mark_draft': {
        if (quote.status === 'accepted') {
          throw new ConflictError('An accepted quote cannot return to draft.');
        }
        return this.repo.setQuoteStatus(id, 'draft');
      }
      default:
        throw new UnprocessableError('Unknown transition.');
    }
  }

  async listVersions(
    id: string,
  ): Promise<{ versionNumber: number; snapshot: unknown; createdAt: Date }[]> {
    await this.repo.getQuote(id);
    return this.repo.listVersions(id);
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async listTemplates(): Promise<QuoteTemplateRow[]> {
    return this.repo.listTemplates();
  }

  async createTemplate(input: {
    name: string;
    bodyTemplate: string;
    branding?: QuoteTemplateRow['branding'];
  }): Promise<QuoteTemplateRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createTemplate({ branchId, ...input });
  }
}
