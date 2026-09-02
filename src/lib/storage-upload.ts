import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

import { env } from '@/lib/env';
import { NotFoundError } from '@/lib/errors';
import { storageInfo } from '@/lib/storage';

export type StorageUploadPurpose = 'inbox' | 'knowledge';

type UploadIntentPayload = {
  expires: number;
  fileName: string;
  key: string;
  mimeType: string;
  organizationId: string;
  purpose: StorageUploadPurpose;
  resourceId: string;
  sizeBytes: number;
  userId: string;
};

const TOKEN_PREFIX = 'upload-v1';

export function createStorageUploadIntent(input: {
  fileName: string;
  mimeType: string;
  organizationId: string;
  purpose: StorageUploadPurpose;
  resourceId: string;
  sizeBytes: number;
  userId: string;
}): { key: string; token: string } {
  const extension = path.extname(input.fileName).slice(0, 16);
  const payload: UploadIntentPayload = {
    ...input,
    expires: Date.now() + 10 * 60_000,
    key: `uploads/${input.purpose}/${randomUUID()}${extension}`,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { key: payload.key, token: `${TOKEN_PREFIX}.${encoded}.${sign(encoded)}` };
}

export function verifyStorageUploadIntent(token: string): UploadIntentPayload {
  const [prefix, encoded, signature] = token.split('.');
  if (
    !encoded ||
    !signature ||
    prefix !== TOKEN_PREFIX ||
    !safeEqual(sign(encoded), signature)
  ) {
    throw new NotFoundError('Upload intent not found.');
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<UploadIntentPayload>;
    if (
      typeof payload.expires !== 'number' ||
      payload.expires < Date.now() ||
      typeof payload.fileName !== 'string' ||
      typeof payload.key !== 'string' ||
      typeof payload.mimeType !== 'string' ||
      typeof payload.organizationId !== 'string' ||
      (payload.purpose !== 'inbox' && payload.purpose !== 'knowledge') ||
      typeof payload.resourceId !== 'string' ||
      typeof payload.sizeBytes !== 'number' ||
      typeof payload.userId !== 'string'
    ) {
      throw new Error('invalid payload');
    }
    return payload as UploadIntentPayload;
  } catch {
    throw new NotFoundError('Upload intent not found.');
  }
}

export async function completeStorageUpload(input: {
  key: string;
  organizationId: string;
  purpose: StorageUploadPurpose;
  resourceId: string;
  token: string;
  userId: string;
}): Promise<{ fileName: string; key: string; mimeType: string; sizeBytes: bigint }> {
  const payload = verifyStorageUploadIntent(input.token);
  if (
    payload.key !== input.key ||
    payload.organizationId !== input.organizationId ||
    payload.purpose !== input.purpose ||
    payload.resourceId !== input.resourceId ||
    payload.userId !== input.userId
  ) {
    throw new NotFoundError('Upload intent not found.');
  }
  const stored = await storageInfo(payload.key);
  const storedMimeType = stored.mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (
    stored.sizeBytes !== payload.sizeBytes ||
    storedMimeType !== payload.mimeType.toLowerCase()
  ) {
    throw new NotFoundError('Uploaded file does not match its intent.');
  }
  return {
    fileName: payload.fileName,
    key: payload.key,
    mimeType: payload.mimeType,
    sizeBytes: BigInt(payload.sizeBytes),
  };
}

function sign(value: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
