import { clientIp } from '@/lib/rate-limit';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import * as integrations from '@/features/integrations/services/integrations.service';
import { integrationProviderSchema } from '@/features/integrations/validators/integrations.validators';

export const POST = withApiHandler<{ provider: string }>(
  'POST /api/integrations/[provider]/test',
  async (request, { correlationId }, context) => {
    const { organizationId, user } = await requirePermission('settings:update');
    const provider = integrationProviderSchema.parse((await context.params).provider);
    const connection = await integrations.testConnection(organizationId, provider, {
      actorId: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ connection }, { correlationId });
  },
);
