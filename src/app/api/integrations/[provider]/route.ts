import { clientIp } from '@/lib/rate-limit';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import * as integrations from '@/features/integrations/services/integrations.service';
import {
  integrationProviderSchema,
  parseIntegrationUpdate,
} from '@/features/integrations/validators/integrations.validators';

export const PUT = withApiHandler<{ provider: string }>(
  'PUT /api/integrations/[provider]',
  async (request, { correlationId }, context) => {
    const { organizationId, user } = await requirePermission('settings:update');
    const provider = integrationProviderSchema.parse((await context.params).provider);
    const input = parseIntegrationUpdate(provider, await request.json());
    const connection = await integrations.configure(organizationId, provider, input, {
      actorId: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ connection }, { correlationId });
  },
);

export const DELETE = withApiHandler<{ provider: string }>(
  'DELETE /api/integrations/[provider]',
  async (request, { correlationId }, context) => {
    const { organizationId, user } = await requirePermission('settings:update');
    const provider = integrationProviderSchema.parse((await context.params).provider);
    await integrations.disconnect(organizationId, provider, {
      actorId: user.id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });
    return jsonSuccess({ disconnected: true }, { correlationId });
  },
);
