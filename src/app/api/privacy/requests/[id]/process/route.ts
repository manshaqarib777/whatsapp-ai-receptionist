import {
  privacyRequestIdSchema,
  processPrivacyRequestSchema,
} from '@/features/privacy/privacy.validators';
import * as privacy from '@/features/privacy/privacy.service';
import { clientIp, consumeDurable } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const POST = withApiHandler<{ id: string }>(
  'POST /api/privacy/requests/[id]/process',
  async (request, { correlationId }, context) => {
    const { organizationId, user } = await requirePermission('settings:update');
    const allowance = await consumeDurable('api', `privacy:${user.id}`);
    if (!allowance.allowed) throw new RateLimitError(allowance.retryAfterSeconds);
    const id = privacyRequestIdSchema.parse((await context.params).id);
    const input = processPrivacyRequestSchema.parse(await request.json());
    const result = await privacy.process(organizationId, id, input, {
      id: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess(result, { correlationId });
  },
);
