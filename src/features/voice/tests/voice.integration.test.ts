// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { TranscriptionsRepository } from '../repositories/transcriptions.repository';
import { putStorage } from '@/lib/storage';
import { processNextTranscription } from '@/workflows/transcription.worker';

let organizationId = '';
let otherId = '';
let branchId = '';
let messageId = '';
let attachmentId = '';
beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const org = await prisma.organization.create({
    data: { name: 'Voice', slug: `voice-${suffix}` },
  });
  organizationId = org.id;
  otherId = (
    await prisma.organization.create({
      data: { name: 'Other Voice', slug: `other-voice-${suffix}` },
    })
  ).id;
  const branch = await prisma.branch.create({
    data: { organizationId, name: 'Main', slug: 'main', isDefault: true },
  });
  branchId = branch.id;
  const contact = await prisma.contact.create({
    data: {
      organizationId,
      branchId,
      displayName: 'Voice Contact',
      phoneNumber: `+9665000${String(Date.now()).slice(-5)}`,
    },
  });
  const wa = await prisma.whatsappAccount.create({
    data: {
      organizationId,
      branchId,
      wabaId: `waba-${suffix}`,
      phoneNumberId: `voice-${suffix}`,
      displayPhoneNumber: '+966500000000',
      accessTokenRef: 'secret/test-only',
    },
  });
  const conversation = await prisma.conversation.create({
    data: { organizationId, branchId, contactId: contact.id, whatsappAccountId: wa.id },
  });
  const message = await prisma.message.create({
    data: {
      organizationId,
      conversationId: conversation.id,
      direction: 'inbound',
      authorType: 'contact',
      contentType: 'audio',
      deliveryStatus: 'delivered',
    },
  });
  messageId = message.id;
  attachmentId = (
    await prisma.messageAttachment.create({
      data: {
        organizationId,
        messageId,
        storageKey: 'voice-test.ogg',
        mimeType: 'audio/ogg',
        sizeBytes: 100n,
      },
    })
  ).id;
});
afterEach(async () => {
  await prisma.transcription.deleteMany({ where: { organizationId } });
  await prisma.messageAttachment.deleteMany({ where: { organizationId } });
  await prisma.message.deleteMany({ where: { organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.whatsappAccount.deleteMany({ where: { organizationId } });
  await prisma.branch.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationId, otherId] } },
  });
});
afterAll(() => prisma.$disconnect());

describe('voice transcription persistence', () => {
  it('queues idempotently and completes a scoped transcript', async () => {
    const repo = new TranscriptionsRepository({ organizationId, branchId });
    const first = await repo.queue({ messageId, attachmentId, language: 'auto' });
    expect((await repo.queue({ messageId, attachmentId, language: 'auto' })).id).toBe(
      first.id,
    );
    await prisma.transcription.updateMany({
      where: { id: first.id },
      data: { status: 'processing', attempts: 1 },
    });
    await repo.complete(first.id, {
      text: 'Confirmed tomorrow.',
      language: 'en',
      confidence: 0.9,
      provider: 'local',
      model: 'demo-stt-v1',
    });
    expect((await repo.listForMessage(messageId))[0]?.text).toBe('Confirmed tomorrow.');
  });
  it('does not expose the transcript to another tenant', async () => {
    await new TranscriptionsRepository({ organizationId, branchId }).queue({
      messageId,
      attachmentId,
      language: 'auto',
    });
    expect(
      await new TranscriptionsRepository({
        organizationId: otherId,
        branchId: null,
      }).listForMessage(messageId),
    ).toHaveLength(0);
  });
  it('runs the durable worker against stored audio', async () => {
    const stored = await putStorage(Buffer.from('synthetic audio bytes'), {
      mimeType: 'audio/ogg',
      fileName: 'worker-demo.ogg',
    });
    await prisma.messageAttachment.update({
      where: { id: attachmentId },
      data: { storageKey: stored.key, sizeBytes: stored.sizeBytes },
    });
    await new TranscriptionsRepository({ organizationId, branchId }).queue({
      messageId,
      attachmentId,
      language: 'auto',
    });
    expect(await processNextTranscription(organizationId)).toBe(true);
    expect(
      (
        await new TranscriptionsRepository({ organizationId, branchId }).listForMessage(
          messageId,
        )
      )[0],
    ).toMatchObject({ status: 'completed', provider: 'local' });
  });
});
