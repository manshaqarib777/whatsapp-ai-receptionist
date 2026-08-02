import { ConflictError, InternalError, NotFoundError } from '@/lib/errors';

/**
 * Helpers that give `updateMany` / `deleteMany` the ergonomics of `update` / `delete`
 * without their tenant-isolation hole.
 *
 * The scope extension refuses unique-selector operations on scoped models, because
 * Prisma will not accept a tenant predicate alongside a unique selector. That leaves
 * the batch operations, which accept any predicate — these helpers restore the
 * "exactly one row, or it is an error" contract on top of them.
 */

type BatchResult = { count: number };

/**
 * Asserts a batch write touched exactly one row.
 *
 * Zero is a 404 rather than a 403: a row that exists in another tenant must be
 * indistinguishable from a row that does not exist, or the response confirms its
 * existence (SECURITY_RULES.md → Tenant Isolation).
 *
 * More than one means the predicate was not as selective as the caller believed,
 * which is a bug in the caller and not something to paper over.
 */
export function expectOne(result: BatchResult, entity: string): void {
  if (result.count === 0) {
    throw new NotFoundError(`${entity} not found.`);
  }

  if (result.count > 1) {
    throw new InternalError(
      `Expected to affect one ${entity} row but affected ${result.count}. ` +
        `The predicate was not unique within the tenant.`,
    );
  }
}

/**
 * Asserts an optimistic-locked write succeeded.
 *
 * A zero count here is ambiguous — the row may be missing, or the caller's `version`
 * may be stale — and the two are reported differently, so the caller passes
 * `exists` from a prior read.
 *
 * DATABASE_RULES.md: "Reject stale writes with 409 rather than silently clobbering a
 * colleague's edit."
 */
export function expectVersionedOne(
  result: BatchResult,
  entity: string,
  exists: boolean,
): void {
  if (result.count === 1) return;

  if (result.count === 0) {
    if (exists) {
      throw new ConflictError(
        `This ${entity} was changed by someone else. Reload and try again.`,
      );
    }

    throw new NotFoundError(`${entity} not found.`);
  }

  throw new InternalError(
    `Expected to affect one ${entity} row but affected ${result.count}.`,
  );
}

/**
 * The `data` clause for an optimistic-locked update.
 *
 * Always paired with `version` in the `where` clause — incrementing without checking
 * is the same race with extra steps.
 */
export function bumpVersion<T extends object>(
  data: T,
): T & { version: { increment: 1 } } {
  return { ...data, version: { increment: 1 } };
}
