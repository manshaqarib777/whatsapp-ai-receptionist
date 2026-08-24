import { requireBranch } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import { searchQuerySchema } from '@/features/knowledge/validators/knowledge.validators';

/**
 * GET /api/knowledge/search?q=&limit= (AD-6).
 *
 * Retrieval over approved current-version chunks only: similarity search through
 * the local hash embedder (or OpenAI when configured), keyword ILIKE fallback.
 * `knowledge:read`.
 */

export const GET = withApiHandler(
  'GET /api/knowledge/search',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranch();
    const url = new URL(request.url);
    const input = searchQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = KnowledgeService.forScope({ organizationId, branchId });
    const hits = await service.search(input.q, input.limit);

    return jsonSuccess({ hits }, { correlationId });
  },
);
