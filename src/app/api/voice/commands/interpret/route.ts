import { interpretVoiceCommand } from '@/features/voice/services/commands';
import { voiceCommandSchema } from '@/features/voice/validators/voice.validators';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const POST = withApiHandler(
  'POST /api/voice/commands/interpret',
  async (request, { correlationId }) => {
    await requirePermission('conversation:write');
    const { transcript } = voiceCommandSchema.parse(await request.json());
    return jsonSuccess({ command: interpretVoiceCommand(transcript) }, { correlationId });
  },
);
