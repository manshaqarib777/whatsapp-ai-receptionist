import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { subscriptionUpdateSchema } from '@/features/admin/admin.validators';
import { record } from '@/features/auth/services/audit-log.service';
import { clientIp } from '@/lib/rate-limit';
import { jsonSuccess, type RouteParams, withApiHandler } from '@/server/api-handler';

type Params = { id: string };
export const PATCH = withApiHandler<Params>(
  'PATCH /api/admin/billing/[id]',
  async (request, { correlationId }, context: RouteParams<Params>) => {
    const admin = await requireAdminRequest();
    const id = (await context.params).id;
    const subscription = await adminService.updateSubscription(
      id,
      subscriptionUpdateSchema.parse(await request.json()),
    );
    await record({
      action: 'platform.subscription_updated',
      actorId: admin.user.id,
      organizationId: subscription.organizationId,
      entityType: 'subscription',
      entityId: id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        version: subscription.version,
      },
    });
    return jsonSuccess({ subscription }, { correlationId });
  },
);
