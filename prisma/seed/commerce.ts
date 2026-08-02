import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId } from './support';
import type { SeededContacts } from './contacts';
import type { SeededTenants } from './tenants';

/**
 * Quotes, invoices, payments.
 *
 * Every figure here is computed the way Milestone 11 and 12 must compute it: the tax
 * RATE and the tax AMOUNT are both stored on the line, at issue time. Nothing is
 * derived at read time. Saudi VAT moved 5% → 15% in 2020, and a system that recomputes
 * historical documents from today's rate silently rewrites its own history.
 *
 * The rate is stored as a fraction (0.1500). A CHECK constraint rejects 15, because
 * confusing the two is a 100× invoicing error.
 */

const VAT_RATE = 0.15;

type LineSpec = { description: string; quantity: number; unitPrice: number };

const QUOTE_PLANS = [
  {
    status: 'accepted' as const,
    ageDays: 40,
    lines: [
      { description: 'Root canal — first visit', quantity: 1, unitPrice: 1450 },
      { description: 'Crown fitting', quantity: 1, unitPrice: 2200 },
    ],
  },
  {
    status: 'sent' as const,
    ageDays: 9,
    lines: [
      {
        description: 'Orthodontic treatment plan — stage 1',
        quantity: 1,
        unitPrice: 6800,
      },
    ],
  },
  {
    status: 'draft' as const,
    ageDays: 1,
    lines: [{ description: 'Scale and polish', quantity: 2, unitPrice: 320 }],
  },
  {
    status: 'rejected' as const,
    ageDays: 22,
    lines: [
      {
        description: 'Full mouth reconstruction — indicative',
        quantity: 1,
        unitPrice: 41000,
      },
    ],
  },
  {
    status: 'expired' as const,
    ageDays: 75,
    lines: [{ description: 'Whitening course', quantity: 1, unitPrice: 1900 }],
  },
];

const INVOICE_PLANS = [
  { status: 'paid' as const, ageDays: 38, amount: 4197.5, paid: 4197.5 },
  { status: 'paid' as const, ageDays: 25, amount: 368.0, paid: 368.0 },
  { status: 'partially_paid' as const, ageDays: 12, amount: 7820.0, paid: 3000.0 },
  { status: 'issued' as const, ageDays: 4, amount: 1667.5, paid: 0 },
  // Due date already passed with nothing paid — the state a collections view needs.
  { status: 'overdue' as const, ageDays: 46, amount: 2530.0, paid: 0 },
  { status: 'draft' as const, ageDays: 0, amount: 690.0, paid: 0 },
  { status: 'void' as const, ageDays: 30, amount: 1150.0, paid: 0 },
];

export type SeededCommerce = Awaited<ReturnType<typeof seedCommerce>>;

export async function seedCommerce(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
  dealIds: string[],
) {
  const quoteIds: string[] = [];

  for (const [index, plan] of QUOTE_PLANS.entries()) {
    const totals = totalsFor(plan.lines);
    const contactId = contacts.riyadhContacts[index % contacts.riyadhContacts.length];
    if (!contactId) continue;

    const quote = await prisma.quote.create({
      data: {
        id: seedId('quote', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        contactId,
        dealId: dealIds[index] ?? null,
        number: `Q-${1000 + index}`,
        status: plan.status,
        subtotalAmount: totals.subtotal.toFixed(4),
        taxAmount: totals.tax.toFixed(4),
        totalAmount: totals.total.toFixed(4),
        currency: 'SAR',
        validUntil: daysFromNow(-plan.ageDays + 30),
        sentAt: plan.status === 'draft' ? null : daysFromNow(-plan.ageDays),
        acceptedAt: plan.status === 'accepted' ? daysFromNow(-plan.ageDays + 3) : null,
        createdAt: daysFromNow(-plan.ageDays),
        updatedAt: SEED_NOW,
      },
    });

    quoteIds.push(quote.id);

    for (const [position, line] of plan.lines.entries()) {
      const lineTotal = line.quantity * line.unitPrice;

      await prisma.quoteLineItem.create({
        data: {
          id: seedId(`quote-line-${index}`, position + 1),
          organizationId: tenants.northwind.id,
          quoteId: quote.id,
          position,
          description: line.description,
          quantity: line.quantity.toFixed(4),
          unitPriceAmount: line.unitPrice.toFixed(4),
          taxRate: VAT_RATE.toFixed(4),
          taxAmount: (lineTotal * VAT_RATE).toFixed(4),
          lineTotalAmount: (lineTotal * (1 + VAT_RATE)).toFixed(4),
          createdAt: daysFromNow(-plan.ageDays),
          updatedAt: SEED_NOW,
        },
      });
    }

    // One historical snapshot on the accepted quote, so the versions table is not
    // empty and Milestone 11 has a shape to read.
    if (plan.status === 'accepted') {
      await prisma.quoteVersion.create({
        data: {
          id: seedId('quote-version', index + 1),
          organizationId: tenants.northwind.id,
          quoteId: quote.id,
          versionNumber: 1,
          snapshot: {
            status: 'sent',
            totalAmount: totals.total.toFixed(4),
            note: 'Before the crown line was added.',
          },
          createdAt: daysFromNow(-plan.ageDays - 2),
        },
      });
    }
  }

  const invoiceIds = await seedInvoices(prisma, tenants, contacts, quoteIds);

  return { quoteIds, invoiceIds };
}

async function seedInvoices(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
  quoteIds: string[],
): Promise<string[]> {
  const invoiceIds: string[] = [];

  for (const [index, plan] of INVOICE_PLANS.entries()) {
    const contactId = contacts.riyadhContacts[index % contacts.riyadhContacts.length];
    if (!contactId) continue;

    const subtotal = plan.amount / (1 + VAT_RATE);
    const tax = plan.amount - subtotal;

    const invoice = await prisma.invoice.create({
      data: {
        id: seedId('invoice', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        contactId,
        // Only the first invoice came from a quote. Most invoices in this business
        // will not, and a seed where every invoice has a quote would let a required
        // relation slip in unnoticed.
        quoteId: index === 0 ? (quoteIds[0] ?? null) : null,
        number: `INV-${1000 + index}`,
        status: plan.status,
        subtotalAmount: subtotal.toFixed(4),
        taxAmount: tax.toFixed(4),
        totalAmount: plan.amount.toFixed(4),
        amountPaid: plan.paid.toFixed(4),
        currency: 'SAR',
        issuedAt: plan.status === 'draft' ? null : daysFromNow(-plan.ageDays),
        dueAt: daysFromNow(-plan.ageDays + 30),
        paidAt: plan.status === 'paid' ? daysFromNow(-plan.ageDays + 6) : null,
        createdAt: daysFromNow(-plan.ageDays),
        updatedAt: SEED_NOW,
      },
    });

    invoiceIds.push(invoice.id);

    await prisma.invoiceLineItem.create({
      data: {
        id: seedId(`invoice-line-${index}`, 1),
        organizationId: tenants.northwind.id,
        invoiceId: invoice.id,
        position: 0,
        description: 'Treatment as per accepted plan',
        quantity: '1.0000',
        unitPriceAmount: subtotal.toFixed(4),
        taxRate: VAT_RATE.toFixed(4),
        taxAmount: tax.toFixed(4),
        lineTotalAmount: plan.amount.toFixed(4),
        createdAt: daysFromNow(-plan.ageDays),
        updatedAt: SEED_NOW,
      },
    });

    if (plan.paid > 0) {
      await seedPayment(prisma, tenants, invoice.id, plan, index);
    }
  }

  return invoiceIds;
}

async function seedPayment(
  prisma: PrismaClient,
  tenants: SeededTenants,
  invoiceId: string,
  plan: (typeof INVOICE_PLANS)[number],
  index: number,
) {
  // Gateways vary across the seed so no formatter can quietly assume one provider.
  const gateway = index % 2 === 0 ? ('hyperpay' as const) : ('stcpay' as const);

  const payment = await prisma.payment.create({
    data: {
      id: seedId('payment', index + 1),
      organizationId: tenants.northwind.id,
      invoiceId,
      gateway,
      gatewayPaymentId: `seed-${gateway}-${index + 1}`,
      amount: plan.paid.toFixed(4),
      currency: 'SAR',
      status: 'succeeded',
      capturedAt: daysFromNow(-plan.ageDays + 6),
      createdAt: daysFromNow(-plan.ageDays + 6),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.paymentEvent.create({
    data: {
      id: seedId('payment-event', index + 1),
      organizationId: tenants.northwind.id,
      paymentId: payment.id,
      gatewayEventId: `seed-evt-${gateway}-${index + 1}`,
      kind: 'payment.captured',
      // Ids and amounts only. No PAN, no cardholder name — storing either would put
      // this system in PCI scope.
      payload: { amount: plan.paid, currency: 'SAR', gateway },
      createdAt: daysFromNow(-plan.ageDays + 6),
    },
  });

  // One partial refund, so the refunds table is exercised and a net-revenue figure
  // has something to subtract.
  if (index === 1) {
    await prisma.refund.create({
      data: {
        id: seedId('refund', 1),
        organizationId: tenants.northwind.id,
        paymentId: payment.id,
        gatewayRefundId: `seed-refund-${index + 1}`,
        amount: '68.0000',
        currency: 'SAR',
        reason: 'Goodwill — appointment ran over.',
        createdAt: daysFromNow(-plan.ageDays + 9),
        updatedAt: SEED_NOW,
      },
    });
  }
}

function totalsFor(lines: readonly LineSpec[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const tax = subtotal * VAT_RATE;
  return { subtotal, tax, total: subtotal + tax };
}
