import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AiEngineService } from '@/features/ai/services/ai-engine.service';
import { runTurnSchema } from '@/features/ai/validators/ai.validators';

/**
 * POST /api/ai/runs (AD-8).
 *
 * Runs one AI engine turn against a conversation. `ai:run`.
 *
 * The engine reads the conversation + message history, classifies intent, runs
 * the matching tool, drafts the reply, applies the hallucination guard, and
 * records an `ai_runs` row. The reply is NOT automatically written to the
 * conversation — the caller (the inbox or a future webhook handler) decides
 * whether to persist it, keeping this a read-mostly surface in M8.
 */

export const POST = withApiHandler(
  'POST /api/ai/runs',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('ai:run');

    const body: unknown = await request.json();
    const input = runTurnSchema.parse(body);

    const service = AiEngineService.forOrganization(organizationId);
    const result = await service.runTurn({
      conversationId: input.conversationId,
      messageText: input.message,
    });

    return jsonSuccess({ run: result }, { correlationId });
  },
);
