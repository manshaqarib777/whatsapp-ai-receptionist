import { TranscriptionsRepository } from '@/features/voice/repositories/transcriptions.repository';
import { requireBranchPermission } from '@/server/auth-context';
import { resolveBranchScope } from '@/server/scope';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { z } from 'zod';

export const GET = withApiHandler<{ messageId: string }>(
  'GET /api/voice/transcriptions/[messageId]',
  async (_request, { correlationId }, context) => {
    const { organizationId, branchId } =
      await requireBranchPermission('conversation:read');
    const messageId = z.uuid().parse((await context.params).messageId);
    const transcriptions = await new TranscriptionsRepository(
      resolveBranchScope(organizationId, branchId),
    ).listForMessage(messageId);
    return jsonSuccess({ transcriptions }, { correlationId });
  },
);
