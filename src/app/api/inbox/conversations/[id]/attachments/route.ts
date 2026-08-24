import { UnprocessableError } from '@/lib/errors';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { putStorage, signStorageKey } from '@/lib/storage';
import { InboxService } from '@/features/inbox/services/inbox.service';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
]);

/**
 * POST /api/inbox/conversations/[id]/attachments
 *
 * Uploads a file and attaches it to a message on the conversation. The request
 * is `multipart/form-data` with a `file` part; the blob goes to local storage
 * (AD-6) and the response carries the storage key + a short-lived signed URL
 * for immediate preview.
 *
 * The upload creates a media message so the attachment is immediately visible
 * in the thread.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/attachments',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File) || file.size === 0) {
      throw new UnprocessableError('A non-empty file is required.');
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new UnprocessableError('Attachments must be 10 MB or smaller.');
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      throw new UnprocessableError('This attachment type is not supported.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await putStorage(bytes, {
      mimeType: file.type,
      fileName: file.name,
    });

    const service = InboxService.forOrganization(organizationId);
    const message = await service.sendMessage({
      conversationId: id,
      authorId: user.id,
      body: file.name,
      contentType: file.type.startsWith('audio/') ? 'audio' : 'document',
    });

    await service.attachToMessage(message.id, {
      storageKey: stored.key,
      mimeType: file.type,
      sizeBytes: stored.sizeBytes,
      fileName: file.name,
    });

    return jsonSuccess(
      {
        message,
        attachment: {
          storageKey: stored.key,
          signedUrl: signStorageKey(stored.key),
        },
      },
      { status: 201, correlationId },
    );
  },
);
