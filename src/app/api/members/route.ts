import * as organizationService from '@/features/auth/services/organization.service';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * GET /api/members — members of the ACTIVE organization.
 *
 * The organization is taken from the session, never from a query parameter, so there
 * is no way to ask this endpoint for another tenant's members.
 */
export const GET = withApiHandler(
  'GET /api/members',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('member:read');

    const members = await organizationService.listMembers(organizationId);

    return jsonSuccess(members, { correlationId });
  },
);
