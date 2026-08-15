// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import {
  InvoicesService,
  type PaymentGatewayAdapter,
} from '@/features/invoices/services/invoices.service';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Invoices integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's invoices. The lifecycle
 * (draft → issued → paid / void), invoice-from-quote (copy + once-only 409),
 * payment reconciliation, webhook replay idempotency, and refunds are
 * exercised against the real database. Payments use a fake gateway adapter so
 * the seam is tested without external credentials.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  contactId: string;
  quoteId: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `invoices-${label}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `invoices-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

async function makeContact(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
      displayName: `Invoice Contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });
  return contact.id;
}

/** A quote to invoice from, with stored rate+amount columns. */
async function makeQuote(
  orgId: string,
  branchId: string,
  contactId: string,
): Promise<string> {
  suffix += 1;
  const quote = await prisma.quote.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      number: `Q-${Date.now()}-${suffix}`,
      status: 'accepted',
      subtotalAmount: 1450,
      taxAmount: 217.5,
      totalAmount: 1667.5,
      currency: 'SAR',
      lineItems: {
        create: [
          {
            organizationId: orgId,
            position: 0,
            description: 'Root canal',
            quantity: 1,
            unitPriceAmount: 1450,
            taxRate: 0.15,
            taxAmount: 217.5,
            lineTotalAmount: 1667.5,
          },
        ],
      },
    },
    select: { id: true },
  });
  return quote.id;
}

/** A fake gateway adapter: deterministic ids, immediate capture on webhook. */
class FakeGateway implements PaymentGatewayAdapter {
  readonly gateway = 'stripe' as const;
  readonly configured = true;

  async createPayment(input: {
    invoice: { number: string };
    amount: number;
    currency: string;
  }): Promise<{ checkoutUrl: string | null; gatewayPaymentId: string }> {
    return {
      checkoutUrl: 'https://checkout.test/session',
      gatewayPaymentId: `fake-${input.invoice.number}-${Date.now()}-${suffix++}`,
    };
  }

  verifyWebhook(): boolean {
    return true;
  }

  async refund(input: {
    payment: { gatewayPaymentId: string };
    amount: number;
  }): Promise<{
    gatewayRefundId: string;
  }> {
    return { gatewayRefundId: `refund-${input.payment.gatewayPaymentId}-${suffix++}` };
  }
}

const LINES = [
  { description: 'Root canal', quantity: 1, unitPriceAmount: 1450 },
  { description: 'Crown fitting', quantity: 1, unitPriceAmount: 2200 },
];

beforeEach(async () => {
  suffix += 1;
  f = {
    orgA: await makeOrg('A'),
    orgB: await makeOrg('B'),
    branchA: '',
    contactId: '',
    quoteId: '',
  };
  f.branchA = await makeBranch(f.orgA, 'Main');
  await makeBranch(f.orgB, 'Main');
  f.contactId = await makeContact(f.orgA, f.branchA);
  f.quoteId = await makeQuote(f.orgA, f.branchA, f.contactId);
});

afterEach(async () => {
  const orgIds = [f.orgA, f.orgB];
  for (const orgId of orgIds) {
    await prisma.paymentEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.refund.deleteMany({ where: { organizationId: orgId } });
    await prisma.payment.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoiceLineItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.quoteLineItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.quote.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function serviceFor(orgId: string): InvoicesService {
  return InvoicesService.withGateways(orgId, [new FakeGateway()]);
}

describe('invoices integration', () => {
  it('creates a draft invoice with computed totals and a sequential number', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });

    expect(invoice.status).toBe('draft');
    expect(invoice.number).toBe('INV-1000');
    // 1450 + 2200 = 3650; VAT 15% = 547.5; total 4197.5
    expect(invoice.subtotalAmount).toBeCloseTo(3650, 4);
    expect(invoice.taxAmount).toBeCloseTo(547.5, 4);
    expect(invoice.totalAmount).toBeCloseTo(4197.5, 4);
    expect(invoice.lineItems).toHaveLength(2);
  });

  it('numbers invoices sequentially', async () => {
    const service = serviceFor(f.orgA);
    const first = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    const second = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    expect(first.number).toBe('INV-1000');
    expect(second.number).toBe('INV-1001');
  });

  it('rejects an unknown contact', async () => {
    const service = serviceFor(f.orgA);
    await expect(
      service.createInvoice({
        contactId: '00000000-0000-4000-8000-000000000000',
        lineItems: LINES,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('invoices from a quote, copying its stored totals, exactly once', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      quoteId: f.quoteId,
    });

    expect(invoice.quoteId).toBe(f.quoteId);
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]?.description).toBe('Root canal');
    expect(invoice.lineItems[0]?.taxRate).toBeCloseTo(0.15, 4);
    expect(invoice.totalAmount).toBeCloseTo(1667.5, 4);

    // A second invoice from the same quote is refused.
    await expect(
      service.createInvoice({ contactId: f.contactId, quoteId: f.quoteId }),
    ).rejects.toThrow(ConflictError);
  });

  it('moves a draft through issue, payment, and paid', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });

    const issued = await service.transition(invoice.id, 'issue');
    expect(issued.status).toBe('issued');
    expect(issued.issuedAt).not.toBeNull();

    const payment = await service.createPayment({
      invoiceId: invoice.id,
      gateway: 'stripe',
      amount: invoice.totalAmount,
    });
    expect(payment.status).toBe('pending');

    // Webhook: checkout.session.completed → succeeded → invoice paid.
    const webhookPayload = JSON.stringify({
      id: `evt-${Date.now()}-${suffix++}`,
      type: 'checkout.session.completed',
      data: { object: { id: payment.gatewayPaymentId, payment_status: 'paid' } },
    });
    await service.handleWebhook({
      gateway: 'stripe',
      signature: 'sig',
      payload: webhookPayload,
    });

    const fresh = await service.getInvoice(invoice.id);
    expect(fresh.status).toBe('paid');
    expect(fresh.amountPaid).toBeCloseTo(invoice.totalAmount, 4);
    expect(fresh.paidAt).not.toBeNull();
  });

  it('webhook replay is a no-op (idempotent via the event journal)', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    await service.transition(invoice.id, 'issue');
    const payment = await service.createPayment({
      invoiceId: invoice.id,
      gateway: 'stripe',
      amount: invoice.totalAmount,
    });

    const eventId = `evt-replay-${suffix++}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: { object: { id: payment.gatewayPaymentId, payment_status: 'paid' } },
    });

    await service.handleWebhook({ gateway: 'stripe', signature: 'sig', payload });
    await service.handleWebhook({ gateway: 'stripe', signature: 'sig', payload });

    const events = await prisma.paymentEvent.count({
      where: { gatewayEventId: eventId },
    });
    expect(events).toBe(1);
    // amountPaid is still exactly the total — not double-applied.
    const fresh = await service.getInvoice(invoice.id);
    expect(fresh.amountPaid).toBeCloseTo(invoice.totalAmount, 4);
  });

  it('refunds a succeeded payment and recomputes the balance', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    await service.transition(invoice.id, 'issue');
    const payment = await service.createPayment({
      invoiceId: invoice.id,
      gateway: 'stripe',
      amount: invoice.totalAmount,
    });
    await service.handleWebhook({
      gateway: 'stripe',
      signature: 'sig',
      payload: JSON.stringify({
        id: `evt-${suffix++}`,
        type: 'checkout.session.completed',
        data: { object: { id: payment.gatewayPaymentId, payment_status: 'paid' } },
      }),
    });

    const refund = await service.refundPayment({ paymentId: payment.id, amount: 500 });
    expect(refund.gatewayRefundId).toContain('refund-');

    const fresh = await service.getInvoice(invoice.id);
    expect(fresh.amountPaid).toBeCloseTo(invoice.totalAmount - 500, 4);
    expect(fresh.status).toBe('partially_paid');
  });

  it('refuses to refund a pending payment', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    await service.transition(invoice.id, 'issue');
    const payment = await service.createPayment({
      invoiceId: invoice.id,
      gateway: 'stripe',
      amount: invoice.totalAmount,
    });

    await expect(
      service.refundPayment({ paymentId: payment.id, amount: 100 }),
    ).rejects.toThrow(ConflictError);
  });

  it('cannot pay a void invoice', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    await service.transition(invoice.id, 'issue');
    await service.transition(invoice.id, 'void');

    await expect(
      service.createPayment({ invoiceId: invoice.id, gateway: 'stripe', amount: 100 }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects an overpayment above the outstanding balance', async () => {
    const service = serviceFor(f.orgA);
    const invoice = await service.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });
    await service.transition(invoice.id, 'issue');

    await expect(
      service.createPayment({
        invoiceId: invoice.id,
        gateway: 'stripe',
        amount: invoice.totalAmount + 1,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('org A never sees org B invoices', async () => {
    const serviceA = serviceFor(f.orgA);
    const serviceB = serviceFor(f.orgB);
    const invoice = await serviceA.createInvoice({
      contactId: f.contactId,
      lineItems: LINES,
    });

    // Org B's list is empty.
    const listB = await serviceB.listInvoices();
    expect(listB).toHaveLength(0);

    // Org B cannot read org A's invoice by id.
    await expect(serviceB.getInvoice(invoice.id)).rejects.toThrow();
  });
});
