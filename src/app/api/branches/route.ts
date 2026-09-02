import { createBranchSchema } from '@/features/organizations/validators/branches.validators';
import * as branchesService from '@/features/organizations/services/branches.service';
import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { clientIp } from '@/lib/rate-limit';

export const GET = withApiHandler(
  'GET /api/branches',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    return jsonSuccess(
      { branches: await branchesService.list(organizationId) },
      { correlationId },
    );
  },
);

export const POST = withApiHandler(
  'POST /api/branches',
  async (request, { correlationId }) => {
    const { organizationId, user } = await requirePermission('organization:update');
    const input = createBranchSchema.parse(await request.json());
    const branch = await branchesService.create(organizationId, input, {
      actorId: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ branch }, { status: 201, correlationId });
  },
);
