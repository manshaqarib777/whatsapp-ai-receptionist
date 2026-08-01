import * as organizationService from '@/features/auth/services/organization.service';
import { updateMemberRoleSchema } from '@/features/auth/validators/auth.validators';
import { clientIp } from '@/lib/rate-limit';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * PATCH  /api/members/:id — change a member's role
 * DELETE /api/members/:id — remove a member
 *
 * Both scope by the session's organization: a member id belonging to another tenant
 * resolves to 404 inside the service, never 403.
 */

type Params = { id: string };

export const PATCH = withApiHandler<Params>(
  'PATCH /api/members/:id',
  async (request, { correlationId }, routeParams) => {
    const auth = await requirePermission('member:update');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const { role } = updateMemberRoleSchema.parse(body);

    const member = await organizationService.updateMemberRole({
      organizationId: auth.organizationId,
      memberId: id,
      role,
      actorId: auth.user.id,
      actorRole: auth.role,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });

    return jsonSuccess(member, { correlationId });
  },
);

export const DELETE = withApiHandler<Params>(
  'DELETE /api/members/:id',
  async (request, { correlationId }, routeParams) => {
    const auth = await requirePermission('member:remove');
    const { id } = await routeParams.params;

    await organizationService.removeMember({
      organizationId: auth.organizationId,
      memberId: id,
      actorId: auth.user.id,
      actorRole: auth.role,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });

    return jsonSuccess({ id }, { correlationId });
  },
);
