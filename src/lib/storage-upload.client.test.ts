import { afterEach, describe, expect, it, vi } from 'vitest';
import { upload } from '@vercel/blob/client';

import { uploadDirectlyWhenConfigured } from '@/lib/storage-upload.client';

vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));

const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
const input = {
  file,
  purpose: 'inbox' as const,
  resourceId: 'eea7e5d2-9462-42d0-9f35-51074c239709',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('client storage uploads', () => {
  it('keeps the server multipart path for local storage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ data: { mode: 'server' } })));

    await expect(uploadDirectlyWhenConfigured(input)).resolves.toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads directly to a private Blob pathname when configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          data: { mode: 'direct', pathname: 'uploads/inbox/file.txt', token: 'intent' },
        }),
      ),
    );
    vi.mocked(upload).mockResolvedValue({
      pathname: 'uploads/inbox/file.txt',
      contentType: 'text/plain',
      contentDisposition: 'attachment',
      url: 'https://private.example/file',
      downloadUrl: 'https://private.example/file?download=1',
      etag: 'etag',
    });

    await expect(uploadDirectlyWhenConfigured(input)).resolves.toEqual({
      storageKey: 'uploads/inbox/file.txt',
      uploadToken: 'intent',
    });
    expect(upload).toHaveBeenCalledWith(
      'uploads/inbox/file.txt',
      file,
      expect.objectContaining({ access: 'private', clientPayload: 'intent' }),
    );
  });
});

function ok(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}
