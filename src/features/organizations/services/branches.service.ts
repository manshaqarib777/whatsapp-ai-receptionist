import { slugify } from '@/features/auth/validators/auth.validators';
import { branchesRepository } from '@/lib/db/auth/branches.repository';
import { ConflictError, NotFoundError } from '@/lib/errors';
import * as auditLog from '@/features/auth/services/audit-log.service';
import type { AuditAction } from '@/features/auth/services/audit-log.service';

type Actor = { actorId: string; ipAddress?: string | null; userAgent?: string | null };

export type BranchSummary = Awaited<ReturnType<typeof branchesRepository.list>>[number];

export function list(organizationId: string): Promise<BranchSummary[]> {
  return branchesRepository.list(organizationId);
}

async function uniqueSlug(organizationId: string, name: string, exceptId?: string) {
  const base = slugify(name) || 'branch';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (!(await branchesRepository.slugExists(organizationId, slug, exceptId)))
      return slug;
  }
  throw new ConflictError('Could not generate a unique branch address.');
}

export async function create(
  organizationId: string,
  input: { name: string; timezone: string },
  actor: Actor,
) {
  const branch = await branchesRepository.create({
    organizationId,
    name: input.name,
    timezone: input.timezone,
    slug: await uniqueSlug(organizationId, input.name),
  });
  await record('branch.created', organizationId, branch.id, actor);
  return branch;
}

export async function update(
  organizationId: string,
  id: string,
  input: { name?: string; timezone?: string },
  actor: Actor,
) {
  const data = {
    ...input,
    ...(input.name ? { slug: await uniqueSlug(organizationId, input.name, id) } : {}),
  };
  const branch = await branchesRepository.update(organizationId, id, data);
  if (!branch) throw new NotFoundError('Branch not found.');
  await record('branch.updated', organizationId, branch.id, actor);
  return branch;
}

export async function setDefault(organizationId: string, id: string, actor: Actor) {
  const branch = await branchesRepository.setDefault(organizationId, id);
  if (!branch) throw new NotFoundError('Branch not found.');
  await record('branch.default_changed', organizationId, branch.id, actor);
  return branch;
}

export async function switchActive(
  sessionId: string,
  organizationId: string,
  branchId: string,
  actor: Actor,
) {
  const branch = await branchesRepository.switchSession(
    sessionId,
    organizationId,
    branchId,
  );
  if (!branch) throw new NotFoundError('Branch not found.');
  await record('branch.switched', organizationId, branch.id, actor);
  return branch;
}

function record(
  action: AuditAction,
  organizationId: string,
  branchId: string,
  actor: Actor,
) {
  return auditLog.record({
    action,
    actorId: actor.actorId,
    organizationId,
    entityType: 'branch',
    entityId: branchId,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
  });
}
