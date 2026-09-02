'use client';

import { upload } from '@vercel/blob/client';

export type DirectUploadReference = {
  storageKey: string;
  uploadToken: string;
};

export async function uploadDirectlyWhenConfigured(input: {
  file: File;
  purpose: 'inbox' | 'knowledge';
  resourceId: string;
}): Promise<DirectUploadReference | null> {
  const response = await fetch('/api/storage/upload-intents', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      fileName: input.file.name,
      mimeType: input.file.type,
      purpose: input.purpose,
      resourceId: input.resourceId,
      sizeBytes: input.file.size,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: { mode: 'server' } | { mode: 'direct'; pathname: string; token: string };
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.data) {
    throw new Error(
      payload?.error?.message ?? `Upload preparation failed (${response.status})`,
    );
  }
  if (payload.data.mode === 'server') return null;

  const blob = await upload(payload.data.pathname, input.file, {
    access: 'private',
    contentType: input.file.type,
    handleUploadUrl: '/api/storage/client-upload',
    clientPayload: payload.data.token,
    multipart: input.file.size > 5 * 1024 * 1024,
  });
  return { storageKey: blob.pathname, uploadToken: payload.data.token };
}
