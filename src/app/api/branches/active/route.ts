import * as branchesService from '@/features/organizations/services/branches.service';
import { switchBranchSchema } from '@/features/organizations/validators/branches.validators';
import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { clientIp } from '@/lib/rate-limit';

export const PATCH = withApiHandler(
  'PATCH /api/branches/active',
  async (request, { correlationId }) => {
    const { organizationId, sessionId, user } = await requireOrg();
    const { branchId } = switchBranchSchema.parse(await request.json());
    const branch = await branchesService.switchActive(
      sessionId,
      organizationId,
      branchId,
      {
        actorId: user.id,
        ipAddress: clientIp(request.headers),
        userAgent: request.headers.get('user-agent'),
      },
    );
    return jsonSuccess({ branch }, { correlationId });
  },
);
