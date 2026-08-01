import * as auditLog from '@/features/auth/services/audit-log.service';
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
    const limitParam = Number(url.searchParams.get('limit'));
    const cursor = url.searchParams.get('cursor');

    const page = await auditLog.list(organizationId, {
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
      ...(cursor ? { cursor } : {}),
    });

    return jsonSuccess(page.entries, {
      correlationId,
      meta: { nextCursor: page.nextCursor, hasMore: page.nextCursor !== null },
    });
  },
);
