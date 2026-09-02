import type { Scope } from '@/lib/db/scope';
import { forScope } from '@/lib/db/scoped-prisma';
import { ConflictError, NotFoundError, UnprocessableError } from '@/lib/errors';

const SELECT = {
  id: true,
  messageId: true,
  attachmentId: true,
  status: true,
  language: true,
  provider: true,
  model: true,
  text: true,
  confidence: true,
  attempts: true,
  maxAttempts: true,
  lastError: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class TranscriptionsRepository {
  private readonly db;
  private readonly scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
    this.db = forScope(scope);
  }

  listForMessage(messageId: string) {
    return this.db.transcription.findMany({
      where: { messageId },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }
  async queue(input: { messageId: string; attachmentId: string; language: string }) {
    const attachment = await this.db.messageAttachment.findFirst({
      where: {
        id: input.attachmentId,
        messageId: input.messageId,
        mimeType: { startsWith: 'audio/' },
        redactedAt: null,
      },
      select: {
        id: true,
        messageId: true,
        storageKey: true,
        mimeType: true,
        sizeBytes: true,
        fileName: true,
        message: { select: { conversation: { select: { branchId: true } } } },
      },
    });
    if (!attachment) throw new NotFoundError('Audio attachment not found.');
    if (attachment.sizeBytes > BigInt(25 * 1024 * 1024))
      throw new UnprocessableError('Audio must be 25 MB or smaller.');
    const existing = await this.db.transcription.findFirst({
      where: { attachmentId: attachment.id },
      select: SELECT,
    });
    if (existing) return existing;
    if (
      !this.scope.branchId ||
      attachment.message.conversation.branchId !== this.scope.branchId
    )
      throw new NotFoundError('Audio attachment not found.');
    return this.db.transcription.create({
      data: {
        organizationId: this.scope.organizationId,
        branchId: this.scope.branchId,
        messageId: input.messageId,
        attachmentId: input.attachmentId,
        language: input.language,
      },
      select: SELECT,
    });
  }
  async getJob(id: string) {
    const row = await this.db.transcription.findFirst({
      where: { id, status: 'processing' },
      select: {
        id: true,
        attachment: { select: { storageKey: true, mimeType: true, fileName: true } },
        language: true,
      },
    });
    if (!row) throw new NotFoundError('Transcription job not found.');
    return row;
  }
  async complete(
    id: string,
    result: {
      text: string;
      language: string;
      confidence: number;
      provider: string;
      model: string;
    },
  ) {
    const updated = await this.db.transcription.updateMany({
      where: { id, status: 'processing' },
      data: {
        status: 'completed',
        ...result,
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    if (!updated.count)
      throw new ConflictError('Transcription job is no longer processing.');
  }
  async fail(id: string, error: string) {
    const job = await this.db.transcription.findFirst({
      where: { id },
      select: { attempts: true, maxAttempts: true },
    });
    if (!job) return;
    await this.db.transcription.updateMany({
      where: { id },
      data: {
        status: job.attempts >= job.maxAttempts ? 'failed' : 'pending',
        lockedAt: null,
        lastError: error.slice(0, 500),
      },
    });
  }
  async retry(id: string) {
    const result = await this.db.transcription.updateMany({
      where: { id, status: 'failed' },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        lockedAt: null,
      },
    });
    if (!result.count)
      throw new ConflictError('Only failed transcriptions can be retried.');
  }
}
