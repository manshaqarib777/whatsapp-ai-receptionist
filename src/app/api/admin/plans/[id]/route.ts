import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { planUpdateSchema } from '@/features/admin/admin.validators';
import { record } from '@/features/auth/services/audit-log.service';
import { clientIp } from '@/lib/rate-limit';
import { jsonSuccess, type RouteParams, withApiHandler } from '@/server/api-handler';

type Params = { id: string };
export const PATCH = withApiHandler<Params>(
  'PATCH /api/admin/plans/[id]',
  async (request, { correlationId }, context: RouteParams<Params>) => {
    const admin = await requireAdminRequest();
    const id = (await context.params).id;
    const plan = await adminService.updatePlan(
      id,
      planUpdateSchema.parse(await request.json()),
    );
    await record({
      action: 'platform.plan_updated',
      actorId: admin.user.id,
      entityType: 'plan',
      entityId: id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
      metadata: { active: plan.active, version: plan.version },
    });
    return jsonSuccess({ plan }, { correlationId });
  },
);
