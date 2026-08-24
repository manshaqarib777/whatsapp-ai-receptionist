import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AiService } from '@/features/ai/services/ai.service';

/**
 * POST /api/ai/templates/[id]/versions/[versionId]/activate
 *
 * Sets a version active and points the template's currentVersionId at it — the
 * engine resolves the active body from here. `ai:manage`.
 */

type Params = { id: string; versionId: string };

export const POST = withApiHandler(
  'POST /api/ai/templates/[id]/versions/[versionId]/activate',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:manage');
    const { id, versionId } = await routeParams.params;
    const service = AiService.forScope({ organizationId, branchId });
    await service.activateVersion(id, versionId);
    return jsonSuccess({ ok: true }, { correlationId });
  },
);
