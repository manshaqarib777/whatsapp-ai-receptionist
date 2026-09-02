import { describe, expect, it } from 'vitest';

import {
  createStorageUploadIntent,
  verifyStorageUploadIntent,
} from '@/lib/storage-upload';

const input = {
  fileName: 'customer-note.pdf',
  mimeType: 'application/pdf',
  organizationId: '89a7ea32-f468-4acf-b4bc-5a17f408d868',
  purpose: 'knowledge' as const,
  resourceId: '9f71cad0-17c0-4f19-b60f-e56a815ea4f1',
  sizeBytes: 4096,
  userId: '966e0356-f87a-4df5-ab36-74435611dbb2',
};

describe('storage upload intents', () => {
  it('round-trips the bounded server-owned upload context', () => {
    const intent = createStorageUploadIntent(input);
    const payload = verifyStorageUploadIntent(intent.token);

    expect(payload).toMatchObject({
      ...input,
      key: intent.key,
    });
    expect(intent.key).toMatch(/^uploads\/knowledge\/[0-9a-f-]+\.pdf$/);
  });

  it('rejects a modified signature', () => {
    const intent = createStorageUploadIntent(input);
    expect(() => verifyStorageUploadIntent(`${intent.token}x`)).toThrow(/not found/i);
  });

  it('does not put the original filename in the private object key', () => {
    const intent = createStorageUploadIntent(input);
    expect(intent.key).not.toContain('customer-note');
  });
});
