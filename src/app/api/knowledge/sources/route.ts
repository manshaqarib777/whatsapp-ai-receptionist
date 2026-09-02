import { requireBranch, requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import { createSourceSchema } from '@/features/knowledge/validators/knowledge.validators';

/**
 * GET/POST /api/knowledge/sources (AD-8).
 *
 * GET lists the org's knowledge sources. POST creates one — FAQ sources ingest
 * synchronously (small, no job), website sources enqueue a job the worker picks
 * up; upload/pdf/docx/csv sources are created as a shell and get their document +
 * job via the upload route.
 */

export const GET = withApiHandler(
  'GET /api/knowledge/sources',
  async (_request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranch();
    const service = KnowledgeService.forScope({ organizationId, branchId });
    const sources = await service.listSources();
    return jsonSuccess({ sources }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/knowledge/sources',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranchPermission('knowledge:write');
    const body: unknown = await request.json();
    const input = createSourceSchema.parse(body);

    const service = KnowledgeService.forScope({ organizationId, branchId });
    const result = await service.createSource({
      kind: input.kind,
      name: input.name,
      url: input.url,
      faq: input.faq,
    });

    return jsonSuccess(result, { status: 201, correlationId });
  },
);
