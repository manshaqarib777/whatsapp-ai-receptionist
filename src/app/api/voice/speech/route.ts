import { speechSchema } from '@/features/voice/validators/voice.validators';
import { speechProvider } from '@/features/voice/services/speech.provider';
import { requirePermission } from '@/server/auth-context';
import { withApiHandler } from '@/server/api-handler';
import { NextResponse } from 'next/server';

export const POST = withApiHandler(
  'POST /api/voice/speech',
  async (request, { correlationId }) => {
    await requirePermission('conversation:read');
    const input = speechSchema.parse(await request.json());
    const result = await speechProvider().synthesize(input);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        'content-type': result.mimeType,
        'cache-control': 'private, no-store',
        'x-correlation-id': correlationId,
        'x-speech-provider': result.provider,
        'x-speech-model': result.model,
      },
    });
  },
);
