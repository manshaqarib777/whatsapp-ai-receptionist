import { AiAgentsService } from '@/features/ai/services/agents.service';
import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/ai/agents',
  async (_request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:read');
    const agents = await AiAgentsService.forScope({ organizationId, branchId }).list();
    return jsonSuccess({ agents }, { correlationId });
  },
);
