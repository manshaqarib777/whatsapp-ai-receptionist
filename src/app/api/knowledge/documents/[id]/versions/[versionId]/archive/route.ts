import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * POST /api/knowledge/documents/[id]/versions/[versionId]/archive
 *
 * pending_approval/approved → archived. A current version stays current; archiving
 * is explicit. `knowledge:approve`.
 */

type Params = { id: string; versionId: string };

export const POST = withApiHandler(
  'POST /api/knowledge/documents/[id]/versions/[versionId]/archive',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('knowledge:approve');
    const { versionId } = await routeParams.params;
    const service = KnowledgeService.forOrganization(organizationId);
    await service.archiveVersion(versionId);
    return jsonSuccess({ ok: true }, { correlationId });
  },
);
