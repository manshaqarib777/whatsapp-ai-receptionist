import { Prisma } from '@prisma/client';

/**
 * Tenant scope — the pair of ids every business query is filtered by.
 *
 * A `Scope` may only be built from server-side state: the session row supplies
 * `organizationId` (see src/server/auth-context.ts), and the branch comes from the
 * session or the organization's default branch. It must never be assembled from a
 * request body, query string, or header (SECURITY_RULES.md → Tenant Isolation).
 *
 * The type is deliberately not exported as a plain object literal shape that callers
 * can conjure — `resolveScope` in src/server/scope.ts is the only intended source.
 */
export type Scope = {
  organizationId: string;
  /** Null for org-level work that spans branches, such as billing or member admin. */
  branchId: string | null;
};

/** A scope that is known to target a specific branch. */
export type BranchScope = Scope & { branchId: string };

/**
 * Model classification, derived from the Prisma DMMF at module load.
 *
 * Deriving it beats maintaining a hand-written list: a table added in a later
 * milestone is classified the moment it has an `organizationId` column, so the
 * registry cannot drift out of step with the schema. A hand-written list would
 * silently omit new tables, and an omitted table is an unscoped table.
 */
function classify() {
  const branchScoped = new Set<string>();
  const orgScoped = new Set<string>();
  const softDeletable = new Set<string>();

  for (const model of Prisma.dmmf.datamodel.models) {
    const fields = new Set(model.fields.map((f) => f.name));

    if (fields.has('deletedAt')) {
      softDeletable.add(model.name);
    }

    if (EXEMPT_MODELS.has(model.name)) {
      continue;
    }

    if (fields.has('branchId')) {
      branchScoped.add(model.name);
    } else if (fields.has('organizationId')) {
      orgScoped.add(model.name);
    }
  }

  return { branchScoped, orgScoped, softDeletable };
}

/**
 * Models the scope extension deliberately leaves alone.
 *
 * `AuditLog` carries a NULLABLE `organizationId` — events such as a failed sign-in
 * happen outside any organization — so a blanket `organizationId = ?` filter would
 * hide exactly the rows a security review needs. It has its own append-only service
 * (src/features/auth/services/audit-log.service.ts) which scopes reads explicitly.
 */
const EXEMPT_MODELS = new Set<string>(['AuditLog']);

const { branchScoped, orgScoped, softDeletable } = classify();

export const BRANCH_SCOPED_MODELS: ReadonlySet<string> = branchScoped;
export const ORG_SCOPED_MODELS: ReadonlySet<string> = orgScoped;
export const SOFT_DELETABLE_MODELS: ReadonlySet<string> = softDeletable;

export function isBranchScoped(model: string): boolean {
  return branchScoped.has(model);
}

export function isOrgScoped(model: string): boolean {
  return orgScoped.has(model) || branchScoped.has(model);
}

export function isSoftDeletable(model: string): boolean {
  return softDeletable.has(model);
}

/**
 * Operations whose `where` must identify exactly one row by a unique field.
 *
 * These are REFUSED on scoped models. Prisma will not accept an arbitrary
 * `organizationId` predicate alongside a unique selector, so there is no way to
 * inject the tenant filter into them — `findUnique({ where: { id } })` would happily
 * return another tenant's row.
 *
 * The filter-based equivalents (`findFirst`, `updateMany`, `deleteMany`) accept any
 * predicate, so scope injection is always sound there. `expectOne` in
 * base-repository.ts restores the "exactly one row" ergonomics.
 */
export const UNIQUE_OPERATIONS: ReadonlySet<string> = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

/** Operations that read or filter rows, and therefore need the scope predicate. */
export const FILTERING_OPERATIONS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/** Operations that write new rows, and therefore need the scope columns set. */
export const CREATING_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);
