import { AiAgentsService } from '@/features/ai/services/agents.service';
import { testAgentSchema } from '@/features/ai/validators/ai.validators';
import { RateLimitError } from '@/lib/errors';
import { consumeDurable } from '@/lib/rate-limit';
import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, type RouteParams, withApiHandler } from '@/server/api-handler';

type Params = { id: string };

export const POST = withApiHandler<Params>(
  'POST /api/ai/agents/[id]/test',
  async (request, { correlationId }, context: RouteParams<Params>) => {
    const { organizationId, branchId, user } = await requireBranchPermission('ai:manage');
    const allowance = await consumeDurable('api', `ai-agent-test:${user.id}`);
    if (!allowance.allowed) throw new RateLimitError(allowance.retryAfterSeconds);
    const input = testAgentSchema.parse(await request.json());
    const result = await AiAgentsService.forScope({ organizationId, branchId }).test(
      (await context.params).id,
      input.message,
    );
    return jsonSuccess({ result }, { correlationId });
  },
);
