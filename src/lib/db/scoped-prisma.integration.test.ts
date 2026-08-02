import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { forScope } from '@/lib/db/scoped-prisma';
import { expectOne, expectVersionedOne } from '@/lib/db/base-repository';
import {
  BRANCH_SCOPED_MODELS,
  ORG_SCOPED_MODELS,
  isBranchScoped,
  isOrgScoped,
  isSoftDeletable,
} from '@/lib/db/scope';
import { prisma } from '@/lib/prisma';
import { ConflictError, InternalError, NotFoundError } from '@/lib/errors';

/**
 * Tenant isolation for Milestone 4's scope extension.
 *
 * DATABASE_RULES.md: "A query that can return another tenant's row is a security
 * incident, not a defect." These prove it against real Postgres rather than asserting
 * it in a comment. Every test that reads across a boundary must come back empty — not
 * throw, not error, but return nothing, because a row in another tenant has to be
 * indistinguishable from a row that does not exist.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA1: string;
  branchA2: string;
  branchB1: string;
  contactA1: string;
  contactA2: string;
  contactB1: string;
};

let f: Fixture;
const created: string[] = [];

async function makeOrg(slug: string): Promise<string> {
  const org = await prisma.organization.create({
    data: { name: slug, slug: `${slug}-${Date.now()}-${created.length}` },
    select: { id: true },
  });
  created.push(org.id);
  return org.id;
}

async function makeBranch(orgId: string, slug: string, isDefault: boolean) {
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: slug,
      slug,
      timezone: 'Asia/Riyadh',
      isDefault,
    },
    select: { id: true },
  });
  return branch.id;
}

async function makeContact(orgId: string, branchId: string, phone: string) {
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: phone,
      displayName: `Contact ${phone}`,
    },
    select: { id: true },
  });
  return contact.id;
}

beforeEach(async () => {
  const orgA = await makeOrg('org-a');
  const orgB = await makeOrg('org-b');

  const branchA1 = await makeBranch(orgA, 'a-main', true);
  const branchA2 = await makeBranch(orgA, 'a-second', false);
  const branchB1 = await makeBranch(orgB, 'b-main', true);

  f = {
    orgA,
    orgB,
    branchA1,
    branchA2,
    branchB1,
    contactA1: await makeContact(orgA, branchA1, '+966500000001'),
    contactA2: await makeContact(orgA, branchA2, '+966500000002'),
    contactB1: await makeContact(orgB, branchB1, '+966500000003'),
  };
});

afterEach(async () => {
  // Contacts cascade from nothing, so remove them explicitly before the orgs.
  await prisma.contact.deleteMany({ where: { organizationId: { in: created } } });
  await prisma.branch.deleteMany({ where: { organizationId: { in: created } } });
  await prisma.organization.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

describe('scope registry, derived from the Prisma DMMF', () => {
  it('classifies every business model, so a new table cannot arrive unscoped', () => {
    // 25 branch-scoped + 28 org-only at the time of writing. The assertion is that
    // the sets are populated and disjoint, not the exact counts, so adding a table
    // in Milestone 5 does not fail this test — it just gets scoped automatically.
    expect(BRANCH_SCOPED_MODELS.size).toBeGreaterThan(20);
    expect(ORG_SCOPED_MODELS.size).toBeGreaterThan(20);

    for (const model of BRANCH_SCOPED_MODELS) {
      expect(ORG_SCOPED_MODELS.has(model)).toBe(false);
    }
  });

  it('treats branch-scoped models as org-scoped too', () => {
    expect(isBranchScoped('Contact')).toBe(true);
    expect(isOrgScoped('Contact')).toBe(true);
  });

  it('leaves identity tables unscoped', () => {
    expect(isOrgScoped('User')).toBe(false);
    expect(isOrgScoped('Organization')).toBe(false);
  });

  it('exempts AuditLog, whose organization_id is nullable by design', () => {
    // A blanket filter would hide sign-in failures, which happen outside any org and
    // are exactly what a security review needs to see.
    expect(isOrgScoped('AuditLog')).toBe(false);
  });

  it('knows which models soft-delete', () => {
    expect(isSoftDeletable('Contact')).toBe(true);
    expect(isSoftDeletable('Message')).toBe(true);
    expect(isSoftDeletable('AiRunCitation')).toBe(false);
  });
});

describe('organization isolation', () => {
  it('does not return another organization rows', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const all = await db.contact.findMany({ select: { id: true } });
    const ids = all.map((c) => c.id);

    expect(ids).toContain(f.contactA1);
    expect(ids).toContain(f.contactA2);
    expect(ids).not.toContain(f.contactB1);
  });

  it('returns empty rather than throwing when reaching for another tenant row', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    // Explicitly asking for org B's contact by id must look identical to asking for
    // a row that does not exist. Throwing, or a distinguishable error, would confirm
    // the row exists somewhere.
    const row = await db.contact.findFirst({ where: { id: f.contactB1 } });

    expect(row).toBeNull();
  });

  it('cannot be widened by passing another organization id in the where clause', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const rows = await db.contact.findMany({ where: { organizationId: f.orgB } });

    // AND of two different organization ids matches nothing. The caller narrows to
    // zero rather than escaping the scope.
    expect(rows).toHaveLength(0);
  });

  it('counts only its own rows', async () => {
    const a = forScope({ organizationId: f.orgA, branchId: null });
    const b = forScope({ organizationId: f.orgB, branchId: null });

    expect(await a.contact.count()).toBe(2);
    expect(await b.contact.count()).toBe(1);
  });

  it('stamps the scope on create, overriding whatever the caller supplied', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: f.branchA1 });

    const row = await db.contact.create({
      data: {
        // A caller trying to plant a row in org B. The extension overwrites it.
        organizationId: f.orgB,
        branchId: f.branchB1,
        phoneNumber: '+966500000099',
        displayName: 'Planted',
      },
      select: { id: true, organizationId: true, branchId: true },
    });

    expect(row.organizationId).toBe(f.orgA);
    expect(row.branchId).toBe(f.branchA1);
  });

  it('cannot update another organization row', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const result = await db.contact.updateMany({
      where: { id: f.contactB1 },
      data: { displayName: 'Hijacked' },
    });

    expect(result.count).toBe(0);

    const untouched = await prisma.contact.findUniqueOrThrow({
      where: { id: f.contactB1 },
      select: { displayName: true },
    });
    expect(untouched.displayName).not.toBe('Hijacked');
  });

  it('cannot delete another organization row', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const result = await db.contact.deleteMany({ where: { id: f.contactB1 } });

    expect(result.count).toBe(0);
    expect(await prisma.contact.count({ where: { id: f.contactB1 } })).toBe(1);
  });
});

describe('branch isolation', () => {
  it('sees only the scoped branch when one is set', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: f.branchA1 });

    const ids = (await db.contact.findMany({ select: { id: true } })).map((c) => c.id);

    expect(ids).toEqual([f.contactA1]);
  });

  it('sees every branch in the organization when the branch is null', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    expect(await db.contact.count()).toBe(2);
  });

  it('never widens past the organization even with a null branch', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const ids = (await db.contact.findMany({ select: { id: true } })).map((c) => c.id);

    expect(ids).not.toContain(f.contactB1);
  });

  it('refuses to write a branch-scoped row without a branch', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    await expect(
      db.contact.create({
        data: { phoneNumber: '+966500000098', displayName: 'No branch' },
      } as never),
    ).rejects.toThrow(InternalError);
  });
});

describe('operations that cannot be scoped are refused', () => {
  it.each(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert'] as const)(
    'refuses %s on a scoped model',
    async (operation) => {
      const db = forScope({ organizationId: f.orgA, branchId: f.branchA1 });

      // Prisma will not accept a tenant predicate beside a unique selector, so these
      // could return another tenant's row. Refusing them is what makes the guarantee
      // absolute rather than best-effort.
      const model = db.contact as unknown as Record<
        string,
        ((a: unknown) => Promise<unknown>) | undefined
      >;
      const call = model[operation];
      if (!call) throw new Error(`${operation} is not present on the model delegate`);

      await expect(
        call({
          where: { id: f.contactB1 },
          data: { displayName: 'x' },
          create: {},
          update: {},
        }),
      ).rejects.toThrow(/not permitted on a tenant-scoped model/);
    },
  );

  it('still allows unique operations on unscoped models', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    const org = await db.organization.findUnique({
      where: { id: f.orgA },
      select: { id: true },
    });

    expect(org?.id).toBe(f.orgA);
  });
});

describe('soft delete', () => {
  it('hides soft-deleted rows by default', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: null });

    await db.contact.updateMany({
      where: { id: f.contactA1 },
      data: { deletedAt: new Date() },
    });

    const ids = (await db.contact.findMany({ select: { id: true } })).map((c) => c.id);

    expect(ids).not.toContain(f.contactA1);
    expect(ids).toContain(f.contactA2);
  });

  it('reveals them when explicitly asked, which is how restore and erasure work', async () => {
    const scope = { organizationId: f.orgA, branchId: null };

    await forScope(scope).contact.updateMany({
      where: { id: f.contactA1 },
      data: { deletedAt: new Date() },
    });

    const withDeleted = forScope(scope, { includeDeleted: true });
    const ids = (await withDeleted.contact.findMany({ select: { id: true } })).map(
      (c) => c.id,
    );

    expect(ids).toContain(f.contactA1);
  });

  it('still scopes by tenant when including deleted rows', async () => {
    const db = forScope(
      { organizationId: f.orgA, branchId: null },
      { includeDeleted: true },
    );

    const ids = (await db.contact.findMany({ select: { id: true } })).map((c) => c.id);

    expect(ids).not.toContain(f.contactB1);
  });

  it('frees the phone number for reuse, via the partial unique index', async () => {
    const scope = { organizationId: f.orgA, branchId: f.branchA1 };

    await forScope(scope).contact.updateMany({
      where: { id: f.contactA1 },
      data: { deletedAt: new Date() },
    });

    // Without `WHERE deleted_at IS NULL` on the unique index this would collide, and
    // a trashed contact would block its number forever.
    //
    // The scope ids are passed even though the extension overwrites them: Prisma's
    // generated types still require them, and the extension guarantees they cannot be
    // wrong rather than making them optional. See the note in scoped-prisma.ts.
    const reused = await forScope(scope).contact.create({
      data: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        phoneNumber: '+966500000001',
        displayName: 'Same number again',
      },
      select: { id: true },
    });

    expect(reused.id).toBeTruthy();
  });
});

describe('expectOne', () => {
  it('passes when exactly one row was affected', () => {
    expect(() => expectOne({ count: 1 }, 'contact')).not.toThrow();
  });

  it('reports zero as not-found, never as forbidden', () => {
    // A 403 would confirm the row exists in another tenant.
    expect(() => expectOne({ count: 0 }, 'contact')).toThrow(NotFoundError);
  });

  it('treats more than one as a caller bug rather than papering over it', () => {
    expect(() => expectOne({ count: 2 }, 'contact')).toThrow(InternalError);
  });
});

describe('optimistic locking', () => {
  it('rejects a stale write with 409 rather than clobbering', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: f.branchA1 });

    const result = await db.contact.updateMany({
      where: { id: f.contactA1, version: 99 },
      data: { displayName: 'Stale' },
    });

    expect(() => expectVersionedOne(result, 'contact', true)).toThrow(ConflictError);
  });

  it('succeeds and increments when the version matches', async () => {
    const db = forScope({ organizationId: f.orgA, branchId: f.branchA1 });

    const result = await db.contact.updateMany({
      where: { id: f.contactA1, version: 1 },
      data: { displayName: 'Fresh', version: { increment: 1 } },
    });

    expect(() => expectVersionedOne(result, 'contact', true)).not.toThrow();

    const after = await db.contact.findFirstOrThrow({
      where: { id: f.contactA1 },
      select: { version: true, displayName: true },
    });

    expect(after.version).toBe(2);
    expect(after.displayName).toBe('Fresh');
  });

  it('reports a missing row as not-found rather than a conflict', () => {
    expect(() => expectVersionedOne({ count: 0 }, 'contact', false)).toThrow(
      NotFoundError,
    );
  });
});
