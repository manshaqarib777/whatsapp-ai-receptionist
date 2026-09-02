import { z } from 'zod';

import { createStorageUploadIntent } from '@/lib/storage-upload';
import { env } from '@/lib/env';
import { UnprocessableError } from '@/lib/errors';
import { requireBranchPermission, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

const inputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  purpose: z.enum(['inbox', 'knowledge']),
  resourceId: z.uuid(),
  sizeBytes: z.number().int().positive(),
});

const INBOX_TYPES = new Set([
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
const KNOWLEDGE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/csv',
  'text/plain',
]);

export const POST = withApiHandler(
  'POST /api/storage/upload-intents',
  async (request, context) => {
    const input = inputSchema.parse(await request.json());
    const auth =
      input.purpose === 'inbox'
        ? await requirePermission('conversation:write')
        : await requireBranchPermission('knowledge:write');
    const maxBytes = input.purpose === 'inbox' ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    const allowed = input.purpose === 'inbox' ? INBOX_TYPES : KNOWLEDGE_TYPES;
    if (input.sizeBytes > maxBytes)
      throw new UnprocessableError(
        `File exceeds the ${maxBytes / 1024 / 1024} MB upload limit.`,
      );
    if (!allowed.has(input.mimeType))
      throw new UnprocessableError('This file type is not supported.');

    if (env.STORAGE_DRIVER !== 'vercel-blob') {
      return jsonSuccess(
        { mode: 'server' as const },
        { correlationId: context.correlationId },
      );
    }
    const intent = createStorageUploadIntent({
      ...input,
      organizationId: auth.organizationId,
      userId: auth.user.id,
    });
    return jsonSuccess(
      { mode: 'direct' as const, pathname: intent.key, token: intent.token },
      { correlationId: context.correlationId },
    );
  },
);
