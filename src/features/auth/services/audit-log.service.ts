import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Append-only audit log (DATABASE_RULES.md → Audit).
 *
 * This module exposes `record` and `list`. There is deliberately NO update and NO
 * delete function — an audit trail that can be edited is not an audit trail. The
 * absence is the control; a comment saying "do not delete" is not.
 *
 * `metadata` carries ids and enum values ONLY. Never email addresses, phone numbers,
 * message bodies, tokens, or names (SECURITY_RULES.md → PII).
 */

export const AUDIT_ACTIONS = [
  'auth.sign_up',
  'auth.sign_in',
  'auth.sign_in_failed',
  'auth.sign_out',
  'auth.email_verified',
  'auth.password_reset_requested',
  'auth.password_reset_completed',
  'auth.password_changed',
  'auth.magic_link_requested',
  'auth.magic_link_used',
  'auth.two_factor_enabled',
  'auth.two_factor_disabled',
  'auth.two_factor_failed',
  'auth.backup_code_used',
  'auth.session_revoked',
  'auth.all_sessions_revoked',
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'organization.switched',
  'member.invited',
  'member.joined',
  'member.role_changed',
  'member.removed',
  'invitation.cancelled',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Keys that must never appear in audit metadata. Enforced rather than trusted:
 * a caller that passes PII gets it stripped, and the omission is logged.
 */
const FORBIDDEN_METADATA_KEYS = new Set([
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
]);

/**
 * Strips forbidden keys from metadata.
 *
 * Exported for direct unit testing — this is a PII control, and it should be provable
 * without a database.
 */
export function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined;

  const clean: Record<string, string | number | boolean | null> = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) {
      rejected.push(key);
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      clean[key] = value;
    } else {
      // Objects and arrays can nest arbitrary PII. Reject rather than traverse.
      rejected.push(key);
    }
  }

  if (rejected.length > 0) {
    logger.warn(
      { rejectedKeys: rejected },
      'audit metadata keys rejected — PII or unsupported type',
    );
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Writes an audit entry.
 *
 * Never throws: a failure to write the audit log must not fail the user's action —
 * being unable to record a successful sign-in is not a reason to reject it. The
 * failure is logged at error level so it is visible in alerting.
 */
export async function record(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        organizationId: entry.organizationId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: sanitiseMetadata(entry.metadata) ?? undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, 'failed to write audit log');
  }
}

export type AuditLogPage = {
  entries: Array<{
    id: string;
    action: string;
    actorId: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date;
    metadata: unknown;
  }>;
  nextCursor: string | null;
};

/**
 * Lists audit entries for one organization, newest first.
 *
 * `organizationId` is a required argument, not optional — a repository method that
 * can be called without a tenant scope will eventually be called without one
 * (SECURITY_RULES.md → Tenant Isolation).
 */
export async function list(
  organizationId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<AuditLogPage> {
  const limit = Math.min(options.limit ?? 50, 100);

  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      actorId: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      metadata: true,
    },
  });

  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;

  return {
    entries,
    nextCursor: hasMore ? (entries[entries.length - 1]?.id ?? null) : null,
  };
}
