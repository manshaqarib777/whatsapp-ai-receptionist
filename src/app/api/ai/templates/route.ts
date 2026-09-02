import { requireBranch, requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AiService } from '@/features/ai/services/ai.service';
import { createTemplateSchema } from '@/features/ai/validators/ai.validators';

/**
 * GET/POST /api/ai/templates (AD-6, AD-8).
 *
 * GET lists the org's prompt templates. POST creates one with its first draft
 * version. Requires `ai:read` / `ai:manage`.
 */

export const GET = withApiHandler(
  'GET /api/ai/templates',
  async (_request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranch();
    const service = AiService.forScope({ organizationId, branchId });
    const templates = await service.listTemplates();
    return jsonSuccess({ templates }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/ai/templates',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:manage');
    const body: unknown = await request.json();
    const input = createTemplateSchema.parse(body);

    const service = AiService.forScope({ organizationId, branchId });
    const result = await service.createTemplate(input);

    return jsonSuccess(result, { status: 201, correlationId });
  },
);
