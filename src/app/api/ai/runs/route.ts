import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AiTurnJobsRepository } from '@/features/ai/repositories/turn-jobs.repository';
import { AiRepository } from '@/features/ai/repositories/ai.repository';
import { resolveBranchScope } from '@/server/scope';
import {
  listRunsQuerySchema,
  runTurnSchema,
} from '@/features/ai/validators/ai.validators';

export const GET = withApiHandler(
  'GET /api/ai/runs',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:read');
    const query = listRunsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const runs = await AiRepository.forScope({ organizationId, branchId }).listRuns(
      query.conversationId,
      query.limit,
    );
    return jsonSuccess({ runs }, { correlationId });
  },
);

/**
 * POST /api/ai/runs (AD-8).
 *
 * Enqueues one AI engine turn from an already-persisted inbound message. `ai:run`.
 *
 * The durable worker reads the persisted message and conversation history,
 * applies the engine guardrails, and records an `ai_runs` row. Repeating the
 * request for the same message returns the same job.
 */

export const POST = withApiHandler(
  'POST /api/ai/runs',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:run');

    const body: unknown = await request.json();
    const input = runTurnSchema.parse(body);

    const jobs = new AiTurnJobsRepository(resolveBranchScope(organizationId, branchId));
    const job = await jobs.enqueue(input.inputMessageId);
    return jsonSuccess({ job }, { status: 202, correlationId });
  },
);
