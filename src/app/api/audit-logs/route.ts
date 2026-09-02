import * as auditLog from '@/features/auth/services/audit-log.service';
import { auditLogQuerySchema } from '@/features/auth/validators/auth.validators';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * GET /api/audit-logs — paginated audit trail for the active organization.
 *
 * Cursor-based, scoped by the session's organization.
 */
export const GET = withApiHandler(
  'GET /api/audit-logs',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('audit:read');

    const url = new URL(request.url);
    const query = auditLogQuerySchema.parse(Object.fromEntries(url.searchParams));

    const page = await auditLog.list(organizationId, {
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return jsonSuccess(page.entries, {
      correlationId,
      meta: { nextCursor: page.nextCursor, hasMore: page.nextCursor !== null },
    });
  },
);
