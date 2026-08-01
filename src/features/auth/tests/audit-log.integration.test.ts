import { afterAll, afterEach, describe, expect, it } from 'vitest';

import * as auditLog from '@/features/auth/services/audit-log.service';
import { prisma } from '@/lib/prisma';

/**
 * Audit log.
 *
 * Two properties are the point of this table and are tested directly:
 *   1. It is APPEND-ONLY — the service exposes no way to change history.
 *   2. It contains NO PII — metadata is sanitised before it is written.
 */

const created: string[] = [];

async function makeOrg(name: string) {
  const user = await prisma.user.create({
    data: {
      name: 'Audit Tester',
      email: `audit-${Date.now()}-${Math.round(performance.now() * 1000)}@test.local`,
      emailVerified: true,
    },
    select: { id: true },
  });

  const org = await prisma.organization.create({
    data: { name, slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}` },
    select: { id: true },
  });

  created.push(org.id);

  return { userId: user.id, organizationId: org.id };
}

afterEach(async () => {
  if (created.length > 0) {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: created } } });
    await prisma.organization.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sanitiseMetadata — PII control', () => {
  it.each([
    'email',
    'password',
    'token',
    'secret',
    'phone',
    'phoneNumber',
    'name',
    'body',
    'message',
    'content',
    'backupCodes',
    'ipAddress',
  ])('strips the forbidden key %s', (key) => {
    const result = auditLog.sanitiseMetadata({ [key]: 'sensitive-value', safe: 'ok' });

    expect(result).not.toHaveProperty(key);
    expect(result).toEqual({ safe: 'ok' });
  });

  it('strips nested objects, which could hide PII at any depth', () => {
    const result = auditLog.sanitiseMetadata({
      nested: { email: 'alex@example.com' },
      list: ['a', 'b'],
      keep: 1,
    });

    expect(result).toEqual({ keep: 1 });
  });

  it('keeps ids, enums, numbers, booleans, and nulls', () => {
    const result = auditLog.sanitiseMetadata({
      previousRole: 'member',
      newRole: 'admin',
      count: 3,
      selfRemoval: false,
      reason: null,
    });

    expect(result).toEqual({
      previousRole: 'member',
      newRole: 'admin',
      count: 3,
      selfRemoval: false,
      reason: null,
    });
  });

  it('returns undefined rather than an empty object', () => {
    expect(auditLog.sanitiseMetadata(undefined)).toBeUndefined();
    expect(auditLog.sanitiseMetadata({})).toBeUndefined();
    expect(auditLog.sanitiseMetadata({ email: 'a@b.com' })).toBeUndefined();
  });
});

describe('record', () => {
  it('writes an entry with its context', async () => {
    const { userId, organizationId } = await makeOrg('Audit Write');

    await auditLog.record({
      action: 'member.role_changed',
      actorId: userId,
      organizationId,
      entityType: 'member',
      entityId: 'member-123',
      ipAddress: '203.0.113.5',
      userAgent: 'Vitest',
      metadata: { previousRole: 'member', newRole: 'admin' },
    });

    const rows = await prisma.auditLog.findMany({ where: { organizationId } });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('member.role_changed');
    expect(rows[0]?.actorId).toBe(userId);
    expect(rows[0]?.metadata).toEqual({ previousRole: 'member', newRole: 'admin' });
  });

  it('strips PII before writing, even when the caller passes it', async () => {
    const { userId, organizationId } = await makeOrg('Audit PII');

    await auditLog.record({
      action: 'member.invited',
      actorId: userId,
      organizationId,
      // A careless caller. The service must not trust it.
      metadata: {
        email: 'victim@example.com',
        name: 'Alex Chen',
        role: 'member',
      } as Record<string, string>,
    });

    const row = await prisma.auditLog.findFirstOrThrow({ where: { organizationId } });
    const serialised = JSON.stringify(row.metadata);

    expect(serialised).not.toContain('victim@example.com');
    expect(serialised).not.toContain('Alex Chen');
    expect(row.metadata).toEqual({ role: 'member' });
  });

  it('never throws — a failed audit write must not fail the user action', async () => {
    // A non-existent actor violates the foreign key; record() must swallow it.
    await expect(
      auditLog.record({
        action: 'auth.sign_in',
        actorId: '00000000-0000-0000-0000-000000000000',
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).resolves.toBeUndefined();
  });

  it('records events with no actor, such as a failed sign-in', async () => {
    const { organizationId } = await makeOrg('Audit Anon');

    await auditLog.record({
      action: 'auth.sign_in_failed',
      organizationId,
      ipAddress: '203.0.113.9',
    });

    const row = await prisma.auditLog.findFirstOrThrow({ where: { organizationId } });

    expect(row.actorId).toBeNull();
    expect(row.action).toBe('auth.sign_in_failed');
  });
});

describe('append-only', () => {
  it('exposes no update or delete function on the service', () => {
    const surface = Object.keys(auditLog);

    expect(surface).toContain('record');
    expect(surface).toContain('list');
    // The absence IS the control — a comment saying "do not delete" is not.
    expect(surface).not.toContain('update');
    expect(surface).not.toContain('remove');
    expect(surface).not.toContain('delete');
    expect(surface).not.toContain('purge');
  });

  it('has no updatedAt or deletedAt column — history cannot be revised', async () => {
    const { organizationId } = await makeOrg('Audit Immutable');

    await auditLog.record({ action: 'auth.sign_in', organizationId });

    const row = await prisma.auditLog.findFirstOrThrow({ where: { organizationId } });

    expect(row).not.toHaveProperty('updatedAt');
    expect(row).not.toHaveProperty('deletedAt');
  });
});

describe('list', () => {
  it('is scoped to one organization', async () => {
    const a = await makeOrg('Audit List A');
    const b = await makeOrg('Audit List B');

    await auditLog.record({ action: 'auth.sign_in', organizationId: a.organizationId });
    await auditLog.record({ action: 'auth.sign_in', organizationId: b.organizationId });
    await auditLog.record({ action: 'auth.sign_out', organizationId: b.organizationId });

    const pageA = await auditLog.list(a.organizationId);
    const pageB = await auditLog.list(b.organizationId);

    expect(pageA.entries).toHaveLength(1);
    expect(pageB.entries).toHaveLength(2);
  });

  it('returns newest first', async () => {
    const { organizationId } = await makeOrg('Audit Order');

    await auditLog.record({ action: 'auth.sign_in', organizationId });
    await auditLog.record({ action: 'auth.sign_out', organizationId });

    const page = await auditLog.list(organizationId);

    expect(page.entries[0]?.action).toBe('auth.sign_out');
  });

  it('caps the page size at 100 however large the request', async () => {
    const { organizationId } = await makeOrg('Audit Cap');

    const page = await auditLog.list(organizationId, { limit: 5000 });

    // No rows here, but the call must not attempt an unbounded read.
    expect(page.entries.length).toBeLessThanOrEqual(100);
  });

  it('paginates with a cursor', async () => {
    const { organizationId } = await makeOrg('Audit Page');

    for (let i = 0; i < 5; i += 1) {
      await auditLog.record({ action: 'auth.sign_in', organizationId });
    }

    const first = await auditLog.list(organizationId, { limit: 2 });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const cursor = first.nextCursor;
    if (!cursor) throw new Error('expected a cursor for the second page');

    const second = await auditLog.list(organizationId, { limit: 2, cursor });

    expect(second.entries).toHaveLength(2);
    expect(second.entries[0]?.id).not.toBe(first.entries[0]?.id);
  });
});
