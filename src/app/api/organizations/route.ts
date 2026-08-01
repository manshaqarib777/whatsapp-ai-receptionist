import * as organizationService from '@/features/auth/services/organization.service';
import { createOrganizationSchema } from '@/features/auth/validators/auth.validators';
import { clientIp } from '@/lib/rate-limit';
import { requireAuth } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * GET  /api/organizations — organizations the caller belongs to
 * POST /api/organizations — create one, caller becomes owner
 *
 * Documented in docs/api/organizations.md.
 */

export const GET = withApiHandler(
  'GET /api/organizations',
  async (_request, { correlationId }) => {
    const { user } = await requireAuth();

    const organizations = await organizationService.listForUser(user.id);

    return jsonSuccess(organizations, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/organizations',
  async (request, { correlationId }) => {
    const { user } = await requireAuth();

    const body: unknown = await request.json();
    const input = createOrganizationSchema.parse(body);

    const organization = await organizationService.create({
      userId: user.id,
      name: input.name,
      ...(input.slug ? { slug: input.slug } : {}),
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });

    return jsonSuccess(organization, { status: 201, correlationId });
  },
);
