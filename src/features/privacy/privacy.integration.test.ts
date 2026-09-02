import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as privacy from '@/features/privacy/privacy.service';

let organizationId: string;
let otherOrganizationId: string;
let userId: string;
let contactId: string;
const created: string[] = [];

beforeAll(async () => {
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: 'owner@northwind.test' },
  });
  const member = await prisma.member.findFirstOrThrow({ where: { userId: owner.id } });
  const other = await prisma.organization.findFirstOrThrow({
    where: { id: { not: member.organizationId } },
  });
  const contact = await prisma.contact.findFirstOrThrow({
    where: { organizationId: member.organizationId, redactedAt: null },
  });
  organizationId = member.organizationId;
  otherOrganizationId = other.id;
  userId = owner.id;
  contactId = contact.id;
});
afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: created } } });
  await prisma.privacyRequest.deleteMany({ where: { id: { in: created.splice(0) } } });
});

describe('privacy workflow', () => {
  it('creates and completes a transient access export without crossing tenants', async () => {
    const request = await privacy.create(
      organizationId,
      { contactId, type: 'access' },
      { id: userId },
    );
    created.push(request.id);
    expect(
      (await privacy.list(otherOrganizationId)).some((row) => row.id === request.id),
    ).toBe(false);
    const result = await privacy.process(
      organizationId,
      request.id,
      { version: request.version },
      { id: userId },
    );
    expect(result.type).toBe('access');
    expect(result.data).toMatchObject({ id: contactId });
    expect(
      (await prisma.privacyRequest.findFirstOrThrow({ where: { id: request.id } }))
        .status,
    ).toBe('completed');
    const audits = await prisma.auditLog.findMany({ where: { entityId: request.id } });
    expect(new Set(audits.map((row) => row.action))).toEqual(
      new Set(['privacy.requested', 'privacy.exported']),
    );
    expect(JSON.stringify(audits)).not.toContain('phoneNumber');
  });
});
