import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

import { env } from '@/lib/env';
import { verifyStorageUploadIntent } from '@/lib/storage-upload';
import { requireBranchPermission, requirePermission } from '@/server/auth-context';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== 'blob.generate-client-token' || !body.payload.clientPayload) {
    return Response.json({ error: 'Invalid upload request.' }, { status: 400 });
  }

  const intent = verifyStorageUploadIntent(body.payload.clientPayload);
  const auth =
    intent.purpose === 'inbox'
      ? await requirePermission('conversation:write')
      : await requireBranchPermission('knowledge:write');
  if (auth.organizationId !== intent.organizationId || auth.user.id !== intent.userId) {
    return Response.json({ error: 'Upload request not found.' }, { status: 404 });
  }

  const result = await handleUpload({
    request,
    body,
    token: env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const verified = verifyStorageUploadIntent(clientPayload ?? '');
      if (pathname !== verified.key || verified.userId !== auth.user.id) {
        throw new Error('Upload request not found.');
      }
      return {
        allowedContentTypes: [verified.mimeType],
        maximumSizeInBytes: verified.sizeBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
        validUntil: verified.expires,
      };
    },
  });
  return Response.json(result);
}
