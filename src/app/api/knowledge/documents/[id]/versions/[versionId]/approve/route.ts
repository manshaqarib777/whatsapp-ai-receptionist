import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * POST /api/knowledge/documents/[id]/versions/[versionId]/approve
 *
 * pending_approval → approved, and the document's currentVersionId points at
 * this version — the retrieval gate. `knowledge:approve` (admin/owner only).
 */

type Params = { id: string; versionId: string };

export const POST = withApiHandler(
  'POST /api/knowledge/documents/[id]/versions/[versionId]/approve',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requirePermission('knowledge:approve');
    const { versionId } = await routeParams.params;
    const service = KnowledgeService.forOrganization(organizationId);
    await service.approveVersion(versionId, user.id);
    return jsonSuccess({ ok: true }, { correlationId });
  },
);
