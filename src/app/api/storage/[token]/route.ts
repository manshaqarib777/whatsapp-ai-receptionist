import { openStorage, verifyStorageToken } from '@/lib/storage';

/**
 * GET /api/storage/[token]
 *
 * Serves a stored attachment through a signed, short-lived URL (AD-6). The token
 * is the signed value from `signStorageKey` — HMAC over AUTH_SECRET with an
 * expiry, so an unsigned or expired URL 404s. The route is deliberately outside
 * the inbox path; any future feature that stores files reuses it.
 */

export const dynamic = 'force-dynamic';

type Params = { token: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const { token } = await params;

  const key = verifyStorageToken(token);
  const stored = await openStorage(key);

  return new Response(stored.body, {
    headers: {
      'content-type': stored.mimeType,
      'content-length': String(stored.sizeBytes),
      // Never cache: the URL is short-lived and a stale copy is a leak vector.
      'cache-control': 'private, no-store',
    },
  });
}
