import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { get, head, put } from '@vercel/blob';

import { env } from '@/lib/env';
import { NotFoundError, UnprocessableError } from '@/lib/errors';

/**
 * Object storage for message attachments and knowledge documents (AD-6).
 *
 * The schema stores a `storage_key`, never a blob. This module is the local
 * implementation stores files under `env.STORAGE_DIR` (gitignored); production
 * can use private Vercel Blob objects through the same interface.
 *
 * The signed URL is a defence-in-depth affordance: attachments are PII-adjacent
 * (x-rays, photos), so the serving route refuses unsigned requests and the URL
 * expires. The signature is HMAC over `AUTH_SECRET` — the same secret the
 * session uses, so there is no new secret to rotate.
 */

const SIGNATURE_PREFIX = 'sig-';

/** Writes a buffer to storage, returns the storage key. */
export async function putStorage(
  data: Buffer,
  options: { mimeType: string; fileName?: string },
): Promise<{ key: string; sizeBytes: bigint }> {
  if (env.STORAGE_DRIVER === 'vercel-blob') {
    const key = `attachments/${randomUUID()}${path.extname(options.fileName ?? '')}`;
    const blob = await put(key, data, {
      access: 'private',
      addRandomSuffix: false,
      contentType: options.mimeType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { key: blob.pathname, sizeBytes: BigInt(data.byteLength) };
  }

  const dir = path.resolve(env.STORAGE_DIR);
  await mkdir(dir, { recursive: true });

  const key = `${randomUUID()}${path.extname(options.fileName ?? '')}`;
  await writeFile(path.join(dir, key), data);
  await writeFile(
    path.join(dir, `${key}.metadata.json`),
    JSON.stringify({ mimeType: options.mimeType }),
  );

  return { key, sizeBytes: BigInt(data.byteLength) };
}

/** Reads a storage key's bytes (for signed serving). */
export async function getStorage(key: string): Promise<Buffer> {
  if (env.STORAGE_DRIVER === 'vercel-blob') {
    try {
      const result = await get(key, {
        access: 'private',
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new NotFoundError('Attachment not found.');
      }
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError('Attachment not found.');
    }
  }

  const filePath = safeResolve(key);
  try {
    return await readFile(filePath);
  } catch {
    throw new NotFoundError('Attachment not found.');
  }
}

/** Opens a key for HTTP serving without buffering a private Blob in memory. */
export async function openStorage(key: string): Promise<{
  body: ReadableStream<Uint8Array>;
  mimeType: string;
  sizeBytes: number;
}> {
  if (env.STORAGE_DRIVER === 'vercel-blob') {
    try {
      const result = await get(key, {
        access: 'private',
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new NotFoundError('Attachment not found.');
      }
      return {
        body: result.stream,
        mimeType: result.blob.contentType || 'application/octet-stream',
        sizeBytes: result.blob.size,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError('Attachment not found.');
    }
  }

  const [buffer, info] = await Promise.all([getStorage(key), storageInfo(key)]);
  return { body: new Blob([new Uint8Array(buffer)]).stream(), ...info };
}

/** Resolves a storage key inside the storage dir, refusing path traversal. */
function safeResolve(key: string): string {
  const root = path.resolve(env.STORAGE_DIR);
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new UnprocessableError('Invalid storage key.');
  }
  return resolved;
}

/** Signs a storage key for short-lived serving: `sig-<hmac>.<key>` */
export function signStorageKey(key: string, ttlMs = 60_000): string {
  const expires = Date.now() + ttlMs;
  const digest = createHmac('sha256', env.AUTH_SECRET)
    .update(`${key}.${expires}`)
    .digest('hex')
    .slice(0, 32);
  return `${SIGNATURE_PREFIX}${expires}.${digest}.${Buffer.from(key).toString('base64url')}`;
}

/** Verifies a signed storage URL token and returns the key, or throws. */
export function verifyStorageToken(token: string): string {
  if (!token.startsWith(SIGNATURE_PREFIX)) {
    throw new NotFoundError('Attachment not found.');
  }

  const [expires, digest, encoded] = token.slice(SIGNATURE_PREFIX.length).split('.');
  if (!expires || !digest || !encoded) {
    throw new NotFoundError('Attachment not found.');
  }

  if (Number(expires) < Date.now()) {
    throw new NotFoundError('Attachment link has expired.');
  }

  const key = Buffer.from(encoded, 'base64url').toString('utf8');
  const expected = createHmac('sha256', env.AUTH_SECRET)
    .update(`${key}.${expires}`)
    .digest('hex')
    .slice(0, 32);

  const expectedBytes = Buffer.from(expected, 'hex');
  const digestBytes = Buffer.from(digest, 'hex');
  if (
    expectedBytes.length !== digestBytes.length ||
    !timingSafeEqual(expectedBytes, digestBytes)
  ) {
    throw new NotFoundError('Attachment not found.');
  }

  return key;
}

/** The mime type + size for a key (used by the serving route headers). */
export async function storageInfo(key: string): Promise<{
  mimeType: string;
  sizeBytes: number;
}> {
  if (env.STORAGE_DRIVER === 'vercel-blob') {
    try {
      const blob = await head(key, { token: env.BLOB_READ_WRITE_TOKEN });
      return {
        mimeType: blob.contentType || 'application/octet-stream',
        sizeBytes: blob.size,
      };
    } catch {
      throw new NotFoundError('Attachment not found.');
    }
  }

  const filePath = safeResolve(key);
  const info = await stat(filePath);
  let mimeType = 'application/octet-stream';
  try {
    const metadata = JSON.parse(await readFile(`${filePath}.metadata.json`, 'utf8')) as {
      mimeType?: unknown;
    };
    if (typeof metadata.mimeType === 'string') mimeType = metadata.mimeType;
  } catch {
    // Older seed/local files predate metadata sidecars and remain downloadable.
  }
  return { mimeType, sizeBytes: info.size };
}
