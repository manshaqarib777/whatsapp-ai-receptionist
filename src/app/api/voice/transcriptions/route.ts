import { queueTranscriptionSchema } from '@/features/voice/validators/voice.validators';
import { TranscriptionsRepository } from '@/features/voice/repositories/transcriptions.repository';
import { requireBranchPermission } from '@/server/auth-context';
import { resolveBranchScope } from '@/server/scope';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const POST = withApiHandler(
  'POST /api/voice/transcriptions',
  async (request, { correlationId }) => {
    const { organizationId, branchId } =
      await requireBranchPermission('conversation:write');
    const input = queueTranscriptionSchema.parse(await request.json());
    const transcription = await new TranscriptionsRepository(
      resolveBranchScope(organizationId, branchId),
    ).queue(input);
    return jsonSuccess({ transcription }, { status: 202, correlationId });
  },
);
