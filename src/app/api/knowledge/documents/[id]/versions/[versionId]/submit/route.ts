import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * POST /api/knowledge/documents/[id]/versions/[versionId]/submit
 *
 * Draft → pending_approval. `knowledge:write`.
 */

type Params = { id: string; versionId: string };

export const POST = withApiHandler(
  'POST /api/knowledge/documents/[id]/versions/[versionId]/submit',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranchPermission('knowledge:write');
    const { versionId } = await routeParams.params;
    const service = KnowledgeService.forScope({ organizationId, branchId });
    await service.submitVersion(versionId);
    return jsonSuccess({ ok: true }, { correlationId });
  },
);
