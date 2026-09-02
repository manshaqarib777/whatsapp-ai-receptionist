import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { PrivacyRepository } from '@/lib/db/privacy.repository';
import { eraseContact } from '@/lib/db/erasure';
import { resolveScope } from '@/server/scope';
import * as audit from '@/features/auth/services/audit-log.service';

type Actor = { id: string; ipAddress?: string | null; userAgent?: string | null };
const repo = (organizationId: string) =>
  new PrivacyRepository(resolveScope(organizationId));

export const list = (organizationId: string) => repo(organizationId).list();
export const targets = (organizationId: string) => repo(organizationId).targets();

export async function create(
  organizationId: string,
  input: { contactId: string; type: 'access' | 'erasure' },
  actor: Actor,
) {
  const result = await repo(organizationId).create({ ...input, requesterId: actor.id });
  if (!result) throw new NotFoundError('Contact not found.');
  if ('duplicateId' in result)
    throw new ConflictError('An equivalent privacy request is already pending.');
  await record('privacy.requested', organizationId, result.id, input.type, actor);
  return result;
}

export async function process(
  organizationId: string,
  id: string,
  input: { version: number; confirmation?: 'ERASE CONTACT' },
  actor: Actor,
) {
  const repository = repo(organizationId);
  const request = await repository.find(id);
  if (!request) throw new NotFoundError('Privacy request not found.');
  if (request.status !== 'pending' || request.version !== input.version)
    throw new ConflictError('The privacy request changed. Refresh and try again.');
  if (request.type === 'erasure' && input.confirmation !== 'ERASE CONTACT') {
    throw new ValidationError('Exact erasure confirmation is required.');
  }
  const data =
    request.type === 'access'
      ? await repository.exportContact(request.contactId)
      : await eraseContact(resolveScope(organizationId), request.contactId);
  if (!data) throw new NotFoundError('Contact not found.');
  if (!(await repository.complete(id, input.version)))
    throw new ConflictError('The privacy request changed. Refresh and try again.');
  await record(
    request.type === 'access' ? 'privacy.exported' : 'privacy.erased',
    organizationId,
    id,
    request.type,
    actor,
  );
  return { requestId: id, type: request.type, data };
}

function record(
  action: audit.AuditAction,
  organizationId: string,
  id: string,
  type: string,
  actor: Actor,
) {
  return audit.record({
    action,
    actorId: actor.id,
    organizationId,
    entityType: 'privacy_request',
    entityId: id,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { type },
  });
}
