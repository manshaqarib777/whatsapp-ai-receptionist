import { createPrivacyRequestSchema } from '@/features/privacy/privacy.validators';
import * as privacy from '@/features/privacy/privacy.service';
import { clientIp } from '@/lib/rate-limit';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/privacy/requests',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('settings:update');
    return jsonSuccess(
      { requests: await privacy.list(organizationId) },
      { correlationId },
    );
  },
);

export const POST = withApiHandler(
  'POST /api/privacy/requests',
  async (request, { correlationId }) => {
    const { organizationId, user } = await requirePermission('settings:update');
    const input = createPrivacyRequestSchema.parse(await request.json());
    const created = await privacy.create(organizationId, input, {
      id: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ request: created }, { correlationId, status: 201 });
  },
);
