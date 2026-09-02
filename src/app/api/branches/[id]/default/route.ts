import * as branchesService from '@/features/organizations/services/branches.service';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { clientIp } from '@/lib/rate-limit';

export const PATCH = withApiHandler<{ id: string }>(
  'PATCH /api/branches/[id]/default',
  async (request, { correlationId }, { params }) => {
    const { organizationId, user } = await requirePermission('organization:update');
    const { id } = await params;
    const branch = await branchesService.setDefault(organizationId, id, {
      actorId: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ branch }, { correlationId });
  },
);
