import { prisma } from '@/lib/prisma';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import { StripePaymentAdapter } from '@/features/invoices/services/stripe.adapter';
import { UnauthenticatedError, UnprocessableError } from '@/lib/errors';

/**
 * Payment webhook entry — Milestone 12.
 *
 * Runs BEFORE a tenant scope exists: the gateway authenticates the request via
 * its own signature, and the owning organization is only discoverable from the
 * payment row the gateway event names. This is the same class of sanctioned
 * pre-scope lookup as `organization.service.ts` (the eslint allow-list entry
 * documents the reason): the `gatewayPaymentId` is globally unique, so an
 * unscoped lookup by it cannot return another tenant's row.
 *
 * Flow: verify signature → resolve org by gateway id → delegate to that org's
 * org-scoped InvoicesService for journaling + reconciliation. Idempotent by
 * construction: the unique `gatewayEventId` makes a retried webhook a no-op.
 */

export async function processPaymentWebhook(
  gateway: string,
  rawBody: string,
  signature: string | null,
): Promise<{ received: boolean }> {
  const adapter = new StripePaymentAdapter();
  if (adapter.gateway !== gateway || !adapter.configured) {
    throw new UnprocessableError(`${gateway} is not configured.`);
  }

  if (!adapter.verifyWebhook(rawBody, signature)) {
    throw new UnauthenticatedError('Invalid webhook signature.');
  }

  // Resolve the owning org from the gateway payment id (globally unique).
  const parsed = JSON.parse(rawBody) as {
    data?: { object?: { id?: string } };
  };
  const gatewayPaymentId = parsed.data?.object?.id;
  if (!gatewayPaymentId) return { received: true };

  const payment = await prisma.payment.findFirst({
    where: { gatewayPaymentId },
    select: { organizationId: true },
  });
  if (!payment) return { received: true };

  const service = InvoicesService.forOrganization(payment.organizationId);
  return service.handleWebhook({
    gateway: adapter.gateway,
    signature,
    payload: rawBody,
  });
}
