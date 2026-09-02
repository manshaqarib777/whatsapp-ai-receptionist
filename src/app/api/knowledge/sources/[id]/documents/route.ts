import { UnprocessableError } from '@/lib/errors';
import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { putStorage } from '@/lib/storage';
import { completeStorageUpload } from '@/lib/storage-upload';
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
    const { organizationId, branchId, user } =
      await requireBranchPermission('knowledge:write');
    const { id } = await routeParams.params;

    const upload = request.headers.get('content-type')?.includes('application/json')
      ? await completeDirectUpload(request, { id, organizationId, userId: user.id })
      : await storeMultipartUpload(request);
    const parsedTitle = uploadSchema.parse({ title: upload.title });

    const service = KnowledgeService.forScope({ organizationId, branchId });
    const result = await service.enqueueUpload({
      sourceId: id,
      title: parsedTitle.title,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      storageKey: upload.key,
      sizeBytes: upload.sizeBytes,
    });

    return jsonSuccess(result, { status: 202, correlationId });
  },
);

async function storeMultipartUpload(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new UnprocessableError('A non-empty file is required.');
  }
  return {
    ...(await putStorage(Buffer.from(await file.arrayBuffer()), {
      mimeType: file.type,
      fileName: file.name,
    })),
    fileName: file.name,
    mimeType: file.type,
    title: String(form.get('title') ?? '').trim(),
  };
}

async function completeDirectUpload(
  request: Request,
  context: { id: string; organizationId: string; userId: string },
) {
  const input = (await request.json()) as {
    storageKey?: unknown;
    title?: unknown;
    uploadToken?: unknown;
  };
  if (
    typeof input.storageKey !== 'string' ||
    typeof input.uploadToken !== 'string' ||
    typeof input.title !== 'string'
  ) {
    throw new UnprocessableError('A completed upload and title are required.');
  }
  return {
    ...(await completeStorageUpload({
      key: input.storageKey,
      token: input.uploadToken,
      purpose: 'knowledge',
      resourceId: context.id,
      organizationId: context.organizationId,
      userId: context.userId,
    })),
    title: input.title,
  };
}
