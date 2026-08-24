import { AiAgentsService } from '@/features/ai/services/agents.service';
import { updateAgentSchema } from '@/features/ai/validators/ai.validators';
import { record } from '@/features/auth/services/audit-log.service';
import { clientIp } from '@/lib/rate-limit';
import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, type RouteParams, withApiHandler } from '@/server/api-handler';

type Params = { id: string };

export const GET = withApiHandler<Params>(
  'GET /api/ai/agents/[id]',
  async (_request, { correlationId }, context) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:read');
    const agent = await AiAgentsService.forScope({ organizationId, branchId }).get(
      (await context.params).id,
    );
    return jsonSuccess({ agent }, { correlationId });
  },
);

export const PATCH = withApiHandler<Params>(
  'PATCH /api/ai/agents/[id]',
  async (request, { correlationId }, context: RouteParams<Params>) => {
    const { organizationId, branchId, user } = await requireBranchPermission('ai:manage');
    const id = (await context.params).id;
    const agent = await AiAgentsService.forScope({ organizationId, branchId }).update(
      id,
      updateAgentSchema.parse(await request.json()),
    );
    await record({
      action: 'ai.agent_updated',
      actorId: user.id,
      organizationId,
      entityType: 'ai_agent',
      entityId: id,
      ipAddress: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
      metadata: { kind: agent.kind, enabled: agent.enabled },
    });
    return jsonSuccess({ agent }, { correlationId });
  },
);
