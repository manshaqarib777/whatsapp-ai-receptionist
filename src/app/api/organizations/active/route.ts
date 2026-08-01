import { headers } from 'next/headers';

import * as organizationService from '@/features/auth/services/organization.service';
import * as auditLog from '@/features/auth/services/audit-log.service';
import { switchOrganizationSchema } from '@/features/auth/validators/auth.validators';
import { auth } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { clientIp } from '@/lib/rate-limit';
import { requireAuth } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * PATCH /api/organizations/active — switch the active organization.
 *
 * The new organization is written to the SESSION ROW, which is what every subsequent
 * request reads for tenant scoping. Membership is verified first: without that check
 * any user could set any organization id and read another tenant's data
 * (SECURITY_RULES.md → Tenant Isolation).
 */
export const PATCH = withApiHandler(
  'PATCH /api/organizations/active',
  async (request, { correlationId }) => {
    const { user } = await requireAuth();

    const body: unknown = await request.json();
    const { organizationId } = switchOrganizationSchema.parse(body);

    const role = await organizationService.membershipRole(organizationId, user.id);

    // Not a member: 404, never 403 — a 403 would confirm the organization exists.
    if (!role) {
      throw new NotFoundError('Organization not found.');
    }

    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId },
    });

    await auditLog.record({
      action: 'organization.switched',
      actorId: user.id,
      organizationId,
      entityType: 'organization',
      entityId: organizationId,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });

    return jsonSuccess({ organizationId, role }, { correlationId });
  },
);
