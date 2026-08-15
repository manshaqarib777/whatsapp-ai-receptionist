import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { InvoicesAggregateRepository } from './invoices.aggregate.repository';
import { InvoicesPaymentsRepository } from './payments.repository';
import { InvoicesRefundsRepository } from './refunds.repository';
import { InvoicesExistenceRepository } from './existence.repository';

/**
 * Invoices data access facade — Milestone 12.
 *
 * The aggregate repositories (invoices, payments, refunds, existence) each own
 * one slice of the invoicing database and stay under the 300-line architecture
 * rule. This facade composes them behind the single `InvoicesRepository`
 * surface the service consumes, so call sites do not change and the
 * tenant-isolation contract lives in `InvoicesBaseRepository`.
 */

export class InvoicesRepository {
  readonly organizationId: string;
  readonly invoices: InvoicesAggregateRepository;
  readonly payments: InvoicesPaymentsRepository;
  readonly refunds: InvoicesRefundsRepository;
  readonly existence: InvoicesExistenceRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.invoices = new InvoicesAggregateRepository(scope);
    this.payments = new InvoicesPaymentsRepository(scope);
    this.refunds = new InvoicesRefundsRepository(scope);
    this.existence = new InvoicesExistenceRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): InvoicesRepository {
    return new InvoicesRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.invoices.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  listInvoices(
    filter?: Parameters<InvoicesAggregateRepository['listInvoices']>[0],
  ): ReturnType<InvoicesAggregateRepository['listInvoices']> {
    return this.invoices.listInvoices(filter);
  }

  getInvoice(id: string): ReturnType<InvoicesAggregateRepository['getInvoice']> {
    return this.invoices.getInvoice(id);
  }

  nextInvoiceNumber(): ReturnType<InvoicesAggregateRepository['nextInvoiceNumber']> {
    return this.invoices.nextInvoiceNumber();
  }

  createInvoice(
    input: Parameters<InvoicesAggregateRepository['createInvoice']>[0],
  ): ReturnType<InvoicesAggregateRepository['createInvoice']> {
    return this.invoices.createInvoice(input);
  }

  updateInvoice(
    id: string,
    data: Parameters<InvoicesAggregateRepository['updateInvoice']>[1],
  ): ReturnType<InvoicesAggregateRepository['updateInvoice']> {
    return this.invoices.updateInvoice(id, data);
  }

  setInvoiceStatus(
    id: string,
    status: Parameters<InvoicesAggregateRepository['setInvoiceStatus']>[1],
    extras?: Parameters<InvoicesAggregateRepository['setInvoiceStatus']>[2],
  ): ReturnType<InvoicesAggregateRepository['setInvoiceStatus']> {
    return this.invoices.setInvoiceStatus(id, status, extras);
  }

  setAmountPaid(
    id: string,
    amountPaid: number,
  ): ReturnType<InvoicesAggregateRepository['setAmountPaid']> {
    return this.invoices.setAmountPaid(id, amountPaid);
  }

  replaceLineItems(
    invoiceId: string,
    lines: Parameters<InvoicesAggregateRepository['replaceLineItems']>[1],
  ): ReturnType<InvoicesAggregateRepository['replaceLineItems']> {
    return this.invoices.replaceLineItems(invoiceId, lines);
  }

  quoteAlreadyInvoiced(
    quoteId: string,
  ): ReturnType<InvoicesAggregateRepository['quoteAlreadyInvoiced']> {
    return this.invoices.quoteAlreadyInvoiced(quoteId);
  }

  getQuoteForInvoice(
    id: string,
  ): ReturnType<InvoicesAggregateRepository['getQuoteForInvoice']> {
    return this.invoices.getQuoteForInvoice(id);
  }

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------

  createPayment(
    input: Parameters<InvoicesPaymentsRepository['createPayment']>[0],
  ): ReturnType<InvoicesPaymentsRepository['createPayment']> {
    return this.payments.createPayment(input);
  }

  listPayments(
    invoiceId: string,
  ): ReturnType<InvoicesPaymentsRepository['listPayments']> {
    return this.payments.listPayments(invoiceId);
  }

  getPayment(id: string): ReturnType<InvoicesPaymentsRepository['getPayment']> {
    return this.payments.getPayment(id);
  }

  getPaymentByGatewayId(
    gatewayPaymentId: string,
  ): ReturnType<InvoicesPaymentsRepository['getPaymentByGatewayId']> {
    return this.payments.getPaymentByGatewayId(gatewayPaymentId);
  }

  setPaymentStatus(
    id: string,
    status: Parameters<InvoicesPaymentsRepository['setPaymentStatus']>[1],
    extras?: Parameters<InvoicesPaymentsRepository['setPaymentStatus']>[2],
  ): ReturnType<InvoicesPaymentsRepository['setPaymentStatus']> {
    return this.payments.setPaymentStatus(id, status, extras);
  }

  appendPaymentEvent(
    input: Parameters<InvoicesPaymentsRepository['appendPaymentEvent']>[0],
  ): ReturnType<InvoicesPaymentsRepository['appendPaymentEvent']> {
    return this.payments.appendPaymentEvent(input);
  }

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  createRefund(
    input: Parameters<InvoicesRefundsRepository['createRefund']>[0],
  ): ReturnType<InvoicesRefundsRepository['createRefund']> {
    return this.refunds.createRefund(input);
  }

  listRefunds(paymentId: string): ReturnType<InvoicesRefundsRepository['listRefunds']> {
    return this.refunds.listRefunds(paymentId);
  }

  // -------------------------------------------------------------------------
  // Existence checks
  // -------------------------------------------------------------------------

  contactExists(id: string): ReturnType<InvoicesExistenceRepository['contactExists']> {
    return this.existence.contactExists(id);
  }
}

// Re-export the shared types so the service keeps one import surface.
export type {
  InvoiceLineItemRow,
  InvoiceRow,
  InvoiceStatus,
  PaymentEventRow,
  PaymentGateway,
  PaymentRow,
  PaymentStatus,
  QuoteForInvoice,
  RefundRow,
} from './invoices.types';
