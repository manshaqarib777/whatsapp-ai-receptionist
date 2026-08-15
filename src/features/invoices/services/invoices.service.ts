import {
  InvoicesRepository,
  type InvoiceRow,
  type InvoiceStatus,
  type PaymentGateway,
  type PaymentRow,
  type RefundRow,
} from '@/features/invoices/repositories/invoices.repository';
import { ConflictError, UnprocessableError } from '@/lib/errors';

import { GATEWAYS, UnconfiguredGateway, type PaymentGatewayAdapter } from './gateway';
import { computeTotals, lineTaxFigures } from './totals';
import type { InvoiceLineInput } from './totals';
import { processGatewayWebhook, reconcileInvoice } from './webhook.processor';

/**
 * Invoices orchestration — Milestone 12.
 *
 * Pure orchestration over the repository: invoice creation (standalone or from
 * a quote) with VAT math, sequential numbering, the status lifecycle
 * (draft → issued → partially_paid → paid / overdue / void), the payment
 * gateway seam, and refunds.
 *
 * Money math mirrors quotations: the tax RATE and tax AMOUNT are both stored
 * per line at write time. Nothing is recomputed from today's rate at read time.
 */

export class InvoicesService {
  private readonly repo: InvoicesRepository;
  readonly organizationId: string;

  /** Registered gateway adapters. Stripe is wired; the rest are unconfigured. */
  private readonly gateways: Map<PaymentGateway, PaymentGatewayAdapter>;

  constructor(repo: InvoicesRepository, adapters: PaymentGatewayAdapter[] = []) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
    this.gateways = new Map();
    for (const gateway of GATEWAYS) {
      this.gateways.set(gateway, new UnconfiguredGateway(gateway));
    }
    for (const adapter of adapters) {
      this.gateways.set(adapter.gateway, adapter);
    }
  }

  static forOrganization(organizationId: string): InvoicesService {
    return new InvoicesService(InvoicesRepository.forOrganization(organizationId));
  }

  /** A service with a custom gateway adapter set (used by tests). */
  static withGateways(
    organizationId: string,
    adapters: PaymentGatewayAdapter[],
  ): InvoicesService {
    return new InvoicesService(
      InvoicesRepository.forOrganization(organizationId),
      adapters,
    );
  }

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  async listInvoices(filter: { status?: InvoiceStatus } = {}): Promise<InvoiceRow[]> {
    return this.repo.listInvoices(filter);
  }

  async getInvoice(id: string): Promise<InvoiceRow> {
    return this.repo.getInvoice(id);
  }

  async listPayments(invoiceId: string): Promise<PaymentRow[]> {
    await this.repo.getInvoice(invoiceId);
    return this.repo.listPayments(invoiceId);
  }

  async listRefunds(paymentId: string): Promise<RefundRow[]> {
    await this.repo.getPayment(paymentId);
    return this.repo.listRefunds(paymentId);
  }

  async createInvoice(input: {
    contactId: string;
    quoteId?: string;
    currency?: string;
    dueAt?: string;
    /** Required when no quoteId; ignored when a quote is copied. */
    lineItems?: InvoiceLineInput[];
  }): Promise<InvoiceRow> {
    if (!(await this.repo.contactExists(input.contactId))) {
      throw new UnprocessableError('Contact not found.');
    }

    let lineItems = input.lineItems ?? [];
    let contactId = input.contactId;
    let currency = input.currency;

    if (input.quoteId) {
      if (await this.repo.quoteAlreadyInvoiced(input.quoteId)) {
        throw new ConflictError('This quote has already been invoiced.');
      }
      const quote = await this.repo.getQuoteForInvoice(input.quoteId);
      if (!quote) {
        throw new UnprocessableError('Quote not found.');
      }
      // Copy the quote's stored rate+amount columns verbatim — a historical
      // document is never recomputed from today's rate.
      lineItems = quote.lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        taxRate: line.taxRate,
      }));
      contactId = quote.contactId;
      currency = currency ?? quote.currency;
    }

    if (lineItems.length === 0) {
      throw new UnprocessableError('An invoice needs at least one line item.');
    }

    const branchId = await this.repo.resolveDefaultBranch();
    const number = await this.repo.nextInvoiceNumber();
    const totals = computeTotals(lineItems);

    return this.repo.createInvoice({
      branchId,
      contactId,
      quoteId: input.quoteId,
      number,
      currency,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      lineItems: lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        ...lineTaxFigures(line),
      })),
      subtotalAmount: totals.subtotalAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
    });
  }

  /**
   * Edit a DRAFT invoice: line items (recomputed totals), due date, currency.
   * Issued or later invoices are immutable (their numbers and figures are the
   * record); revise from a new draft instead.
   */
  async updateInvoice(
    id: string,
    input: {
      dueAt?: string | null;
      currency?: string;
      lineItems?: InvoiceLineInput[];
    },
  ): Promise<InvoiceRow> {
    const invoice = await this.repo.getInvoice(id);
    if (invoice.status !== 'draft') {
      throw new ConflictError(
        'Only a draft invoice can be edited. Issue a new draft instead.',
      );
    }

    if (input.lineItems) {
      const totals = computeTotals(input.lineItems);
      await this.repo.updateInvoice(id, {
        ...(input.dueAt !== undefined
          ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
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
          ...lineTaxFigures(line),
        })),
      );
      return this.repo.getInvoice(id);
    }

    return this.repo.updateInvoice(id, {
      ...(input.dueAt !== undefined
        ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    });
  }

  /**
   * Status transitions. `issue` moves a draft to issued; `void` cancels; a
   * `mark_paid` is a manual override for cash/offline payments.
   */
  async transition(
    id: string,
    action: 'issue' | 'void' | 'mark_paid',
  ): Promise<InvoiceRow> {
    const invoice = await this.repo.getInvoice(id);
    const now = new Date();

    switch (action) {
      case 'issue': {
        if (invoice.status !== 'draft') {
          throw new ConflictError('Only a draft invoice can be issued.');
        }
        return this.repo.setInvoiceStatus(id, 'issued', { issuedAt: now });
      }
      case 'void': {
        if (invoice.status === 'paid' || invoice.status === 'void') {
          throw new ConflictError('A paid or void invoice cannot be voided.');
        }
        return this.repo.setInvoiceStatus(id, 'void');
      }
      case 'mark_paid': {
        if (invoice.status === 'void') {
          throw new ConflictError('A void invoice cannot be marked paid.');
        }
        return this.repo.setInvoiceStatus(id, 'paid', { paidAt: now });
      }
      default:
        throw new UnprocessableError('Unknown transition.');
    }
  }

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------

  async createPayment(input: {
    invoiceId: string;
    gateway: PaymentGateway;
    amount: number;
    currency?: string;
  }): Promise<PaymentRow> {
    const invoice = await this.repo.getInvoice(input.invoiceId);
    if (invoice.status === 'void') {
      throw new ConflictError('A void invoice cannot be paid.');
    }
    const remaining = invoice.totalAmount - invoice.amountPaid;
    if (input.amount > remaining + 0.0001) {
      throw new UnprocessableError(
        `Amount exceeds the outstanding balance of ${remaining.toFixed(2)}.`,
      );
    }

    const adapter = this.gateways.get(input.gateway);
    if (!adapter || !adapter.configured) {
      throw new UnprocessableError(`${input.gateway} is not configured.`);
    }

    const checkout = await adapter.createPayment({
      invoice,
      amount: input.amount,
      currency: input.currency ?? invoice.currency,
    });

    return this.repo.createPayment({
      invoiceId: invoice.id,
      gateway: input.gateway,
      gatewayPaymentId: checkout.gatewayPaymentId,
      amount: input.amount,
      currency: input.currency ?? invoice.currency,
    });
  }

  /**
   * Gateway webhook entry. Verifies the signature, looks the payment up by the
   * gateway id, journals the event (idempotent), and advances the payment and
   * invoice when it succeeds. `payload` is the RAW body text — the adapter's
   * `verifyWebhook` needs it for signature verification.
   */
  async handleWebhook(input: {
    gateway: PaymentGateway;
    signature: string | null;
    payload: string;
  }): Promise<{ received: boolean }> {
    return processGatewayWebhook(this.repo, this.gateways, input);
  }

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  async refundPayment(input: {
    paymentId: string;
    amount: number;
    reason?: string;
  }): Promise<RefundRow> {
    const payment = await this.repo.getPayment(input.paymentId);
    if (payment.status !== 'succeeded') {
      throw new ConflictError('Only a succeeded payment can be refunded.');
    }
    const refundedSoFar = (await this.repo.listRefunds(payment.id)).reduce(
      (sum, refund) => sum + refund.amount,
      0,
    );
    if (input.amount > payment.amount - refundedSoFar + 0.0001) {
      throw new UnprocessableError('Refund exceeds the payment balance.');
    }

    const adapter = this.gateways.get(payment.gateway);
    if (!adapter || !adapter.configured) {
      throw new UnprocessableError(`${payment.gateway} is not configured.`);
    }
    const result = await adapter.refund({
      payment,
      amount: input.amount,
      currency: payment.currency,
    });

    const refund = await this.repo.createRefund({
      paymentId: payment.id,
      gatewayRefundId: result.gatewayRefundId,
      amount: input.amount,
      currency: payment.currency,
      reason: input.reason,
    });

    await reconcileInvoice(this.repo, payment.invoiceId);
    return refund;
  }
}

// Re-export the extracted modules so existing consumers keep one import surface.
export {
  DEFAULT_VAT_RATE,
  computeTotals,
  lineTaxFigures,
  type InvoiceLineInput,
  type InvoiceTotals,
} from './totals';
export { GATEWAYS, UnconfiguredGateway, type PaymentGatewayAdapter } from './gateway';
