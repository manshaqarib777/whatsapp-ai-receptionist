import { UnprocessableError } from '@/lib/errors';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { putStorage } from '@/lib/storage';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import { uploadSchema } from '@/features/knowledge/validators/knowledge.validators';

/**
 * POST /api/knowledge/sources/[id]/documents (AD-8).
 *
 * Uploads a PDF/DOCX/CSV against a source. Multipart/form-data with a `file`
 * part and a `title` field. The blob goes to local storage, the document +
 * draft version rows are created, and a `queued` ingestion job is enqueued. The
 * response carries the job id — the UI polls `GET /api/knowledge/jobs/[id]`.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/knowledge/sources/[id]/documents',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('knowledge:write');
    const { id } = await routeParams.params;

    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') ?? '').trim();

    if (!(file instanceof File) || file.size === 0) {
      throw new UnprocessableError('A non-empty file is required.');
    }

    const parsedTitle = uploadSchema.parse({ title });

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await putStorage(bytes, {
      mimeType: file.type,
      fileName: file.name,
    });

    const service = KnowledgeService.forOrganization(organizationId);
    const result = await service.enqueueUpload({
      sourceId: id,
      title: parsedTitle.title,
      fileName: file.name,
      mimeType: file.type,
      storageKey: stored.key,
      sizeBytes: stored.sizeBytes,
    });

    return jsonSuccess(result, { status: 202, correlationId });
  },
);
