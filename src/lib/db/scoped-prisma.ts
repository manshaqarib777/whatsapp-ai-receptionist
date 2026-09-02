import { prisma } from '@/lib/prisma';
import { InternalError } from '@/lib/errors';
import {
  CREATING_OPERATIONS,
  FILTERING_OPERATIONS,
  UNIQUE_OPERATIONS,
  isBranchScoped,
  isOrgScoped,
  isSoftDeletable,
  type Scope,
} from '@/lib/db/scope';

/**
 * The tenant isolation control.
 *
 * DATABASE_RULES.md: "A query that can return another tenant's row is a security
 * incident, not a defect." A guarantee at that level cannot rest on every author
 * remembering a `where` clause several hundred times, so it is enforced here instead:
 * this extension injects `organization_id` (and `branch_id` where the model has one)
 * into every query, and refuses the operations it cannot safely inject into.
 *
 * This is currently the ONLY layer. Postgres RLS as defence in depth is deferred to
 * Milestone 23, where a least-privilege database role is already in scope — Prisma's
 * pooled driver adapter has no per-request hook, so a policy would need `SET LOCAL`
 * inside an explicit transaction around every read, and a policy that passes when the
 * setting is absent blocks nothing. Treat this extension as load-bearing rather than
 * as one of two belts: it runs in-process, so the isolation tests exercise the exact
 * code path the application takes.
 *
 * ## Known limits, stated rather than discovered later
 *
 * 1. **Nested writes are not injected.** A `create` with nested relation writes is one
 *    query, so the extension only sees the top level. This fails CLOSED: the nested
 *    row is missing a NOT NULL `organization_id` and Postgres rejects the whole
 *    statement. Loud, not silent — but it means repositories write relations as
 *    separate calls inside a transaction.
 * 2. **Raw SQL is not injected.** `$queryRaw` bypasses extensions entirely. The
 *    knowledge-base similarity search is raw by necessity (pgvector), so it must scope
 *    itself, and its test asserts it does.
 * 3. **Types still require the scope columns on `create`.** The injection happens at
 *    runtime, so Prisma's generated input types are unchanged and a repository must
 *    still pass `organizationId` (and `branchId`). That is redundant but not unsafe:
 *    whatever is passed is overwritten with the real scope, so the fields are a typing
 *    formality and cannot carry a wrong value into the database. Making them optional
 *    would mean generating 50 bespoke input types, which buys brevity at the cost of
 *    the thing that makes this enforceable.
 */

type ScopedClient = ReturnType<typeof buildScopedClient>;

export type ScopeOptions = {
  /**
   * Include soft-deleted rows. Needed by exactly two callers: a restore-from-trash
   * flow, and the erasure path, which must reach rows a user already trashed.
   */
  includeDeleted?: boolean;
};

function buildScopedClient(scope: Scope, options: ScopeOptions) {
  const includeDeleted = options.includeDeleted ?? false;

  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        // Prisma types extension arguments as a union across every operation, so
        // there is no single static shape for `args` here. The runtime checks below
        // are what narrow it, per operation.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          const scoped = isOrgScoped(model);
          const softDeletable = isSoftDeletable(model);

          if (!scoped && !softDeletable) {
            return query(args);
          }

          if (scoped && UNIQUE_OPERATIONS.has(operation)) {
            // Prisma will not accept a non-unique predicate beside a unique selector,
            // so there is no way to inject the tenant filter into these. Refusing them
            // is what makes the guarantee absolute instead of best-effort.
            throw new InternalError(
              `${model}.${operation}() is not permitted on a tenant-scoped model: ` +
                `it selects by unique key, so the tenant filter cannot be applied and ` +
                `the query could return another tenant's row. ` +
                `Use findFirst / updateMany / deleteMany, with expectOne() where ` +
                `exactly one row is required.`,
            );
          }

          if (FILTERING_OPERATIONS.has(operation)) {
            const predicate = buildPredicate(model, scope, {
              scoped,
              softDeletable,
              includeDeleted,
            });

            if (predicate) {
              // AND rather than merge: a caller cannot widen the scope by passing its
              // own organizationId, only narrow the result to nothing.
              args.where = args.where ? { AND: [predicate, args.where] } : predicate;
            }

            return query(args);
          }

          if (scoped && CREATING_OPERATIONS.has(operation)) {
            const columns = scopeColumns(model, scope);

            if (Array.isArray(args.data)) {
              args.data = args.data.map((row: object) => ({ ...row, ...columns }));
            } else if (args.data) {
              args.data = { ...args.data, ...columns };
            }

            return query(args);
          }

          return query(args);
        },
      },
    },
  });
}

function scopeColumns(model: string, scope: Scope): Record<string, string> {
  const columns: Record<string, string> = { organizationId: scope.organizationId };

  if (isBranchScoped(model)) {
    if (!scope.branchId) {
      throw new InternalError(
        `${model} is branch-scoped but the current scope has no branch. ` +
          `Resolve a branch before writing branch-scoped data.`,
      );
    }

    columns['branchId'] = scope.branchId;
  }

  return columns;
}

function buildPredicate(
  model: string,
  scope: Scope,
  flags: { scoped: boolean; softDeletable: boolean; includeDeleted: boolean },
): Record<string, unknown> | null {
  const predicate: Record<string, unknown> = {};

  if (flags.scoped) {
    predicate['organizationId'] = scope.organizationId;

    // A null branch means "across all branches of this organization" — used by
    // org-level reporting. It never widens past the organization.
    if (isBranchScoped(model) && scope.branchId) {
      predicate['branchId'] = scope.branchId;
    }
  }

  if (flags.softDeletable && !flags.includeDeleted) {
    predicate['deletedAt'] = null;
  }

  return Object.keys(predicate).length > 0 ? predicate : null;
}

/**
 * A Prisma client bound to one tenant.
 *
 * Every repository takes a `Scope` and calls this. Importing `@/lib/prisma` directly is
 * an ESLint error outside the database layer and a short allow-list of callers that run
 * before a scope exists (session resolution, org creation, the liveness probe) — a
 * comment asking people not to is not a control.
 */
export function forScope(scope: Scope, options: ScopeOptions = {}): ScopedClient {
  return buildScopedClient(scope, options);
}
