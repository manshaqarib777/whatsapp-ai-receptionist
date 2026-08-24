import { NotFoundError, UnprocessableError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';

const JOB_SELECT = {
  id: true,
  conversationId: true,
  inputMessageId: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  runId: true,
  lastError: true,
} as const;
export type AiTurnJobRow = {
  id: string;
  conversationId: string;
  inputMessageId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  maxAttempts: number;
  runId: string | null;
  lastError: string | null;
};

export class AiTurnJobsRepository {
  private readonly db: ReturnType<typeof forScope>;
  constructor(private readonly scope: Scope) {
    this.db = forScope(scope);
  }

  async enqueue(inputMessageId: string): Promise<AiTurnJobRow> {
    const message = await this.db.message.findFirst({
      where: { id: inputMessageId },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        authorType: true,
        body: true,
        conversation: { select: { branchId: true } },
      },
    });
    if (!message) throw new NotFoundError('Input message not found.');
    if (message.direction !== 'inbound' || message.authorType !== 'contact')
      throw new UnprocessableError('Only inbound customer messages can start AI turns.');
    if (!message.body?.trim())
      throw new UnprocessableError('The inbound message must contain text.');
    const branchDb = forScope({
      organizationId: this.scope.organizationId,
      branchId: message.conversation.branchId,
    });
    await branchDb.aiTurnJob.createMany({
      data: [
        {
          organizationId: this.scope.organizationId,
          branchId: message.conversation.branchId,
          conversationId: message.conversationId,
          inputMessageId: message.id,
        },
      ],
      skipDuplicates: true,
    });
    return this.getByMessageId(inputMessageId);
  }

  async get(id: string): Promise<AiTurnJobRow> {
    const row = await this.db.aiTurnJob.findFirst({ where: { id }, select: JOB_SELECT });
    if (!row) throw new NotFoundError('AI turn job not found.');
    return row;
  }

  async getByMessageId(inputMessageId: string): Promise<AiTurnJobRow> {
    const row = await this.db.aiTurnJob.findFirst({
      where: { inputMessageId },
      select: JOB_SELECT,
    });
    if (!row) throw new NotFoundError('AI turn job not found.');
    return row;
  }

  async getInput(jobId: string) {
    const row = await this.db.aiTurnJob.findFirst({
      where: { id: jobId, status: 'running' },
      select: { conversationId: true, inputMessage: { select: { body: true } } },
    });
    if (!row) throw new NotFoundError('Claimed AI turn job not found.');
    return {
      conversationId: row.conversationId,
      messageText: row.inputMessage.body ?? '',
    };
  }

  async succeed(id: string, runId: string): Promise<void> {
    await this.db.aiTurnJob.updateMany({
      where: { id, status: 'running' },
      data: { status: 'succeeded', runId, lockedAt: null, lastError: null },
    });
  }

  async fail(id: string, message: string): Promise<void> {
    const job = await this.get(id);
    await this.db.aiTurnJob.updateMany({
      where: { id, status: 'running' },
      data: {
        status: job.attempts >= job.maxAttempts ? 'failed' : 'queued',
        lockedAt: null,
        lastError: message.slice(0, 1000),
      },
    });
  }
}
