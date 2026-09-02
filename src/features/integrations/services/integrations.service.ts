import { ConflictError, NotFoundError, UnprocessableError } from '@/lib/errors';
import { env } from '@/lib/env';
import { IntegrationsRepository } from '@/lib/db/integrations.repository';
import { resolveScope } from '@/server/scope';
import * as auditLog from '@/features/auth/services/audit-log.service';
import { INTEGRATION_CATALOG, type IntegrationProvider } from './catalog';
import { credentialHint, encryptSecret } from '@/lib/encryption';
import { cacheGetOrLoad, invalidateTenantCache } from '@/lib/cache';

type Actor = { actorId: string; ipAddress?: string | null; userAgent?: string | null };

export async function list(organizationId: string) {
  const rows = await cacheGetOrLoad({
    namespace: 'integrations',
    organizationId,
    identifier: 'catalog-v1',
    ttlSeconds: 30,
    load: () => repository(organizationId).list(),
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return INTEGRATION_CATALOG.map((definition) => ({
    ...definition,
    connection: byProvider.get(definition.provider) ?? null,
  }));
}

export async function configure(
  organizationId: string,
  provider: IntegrationProvider,
  input: {
    enabled: boolean;
    mode: string;
    config: Record<string, string>;
    credential?: string;
    version?: number;
  },
  actor: Actor,
) {
  if (input.mode === 'live' && env.INTEGRATIONS_LIVE_ENABLED !== 'true') {
    throw new UnprocessableError(
      'Live integrations are disabled. Use sandbox mode or configure the server integration environment.',
    );
  }
  const credential = input.credential
    ? {
        credentialCiphertext: encryptSecret(
          input.credential,
          `${organizationId}:${provider}`,
        ),
        credentialHint: credentialHint(input.credential),
        credentialKeyVersion: 1,
      }
    : undefined;
  const connection = await repository(organizationId).save(provider, {
    ...input,
    ...credential,
  });
  if (!connection)
    throw new ConflictError('The integration changed. Refresh and try again.');
  await invalidateTenantCache('integrations', organizationId, 'catalog-v1');
  await record('integration.configured', organizationId, connection.id, provider, actor);
  return connection;
}

export async function testConnection(
  organizationId: string,
  provider: IntegrationProvider,
  actor: Actor,
) {
  const repo = repository(organizationId);
  const connection = await repo.find(provider);
  if (!connection) throw new NotFoundError('Integration not found.');
  if (!connection.enabled)
    throw new UnprocessableError('Enable the integration before testing it.');
  const testedAt = new Date();
  const healthy = connection.mode === 'sandbox';
  const updated = await repo.recordTest(provider, {
    status: healthy ? 'connected' : 'error',
    testedAt,
    error: healthy ? null : 'Live provider credentials are not configured.',
  });
  if (!updated) throw new NotFoundError('Integration not found.');
  await invalidateTenantCache('integrations', organizationId, 'catalog-v1');
  await record('integration.tested', organizationId, updated.id, provider, actor);
  return updated;
}

export async function disconnect(
  organizationId: string,
  provider: IntegrationProvider,
  actor: Actor,
) {
  const repo = repository(organizationId);
  const existing = await repo.find(provider);
  if (!existing) throw new NotFoundError('Integration not found.');
  await repo.disconnect(provider);
  await invalidateTenantCache('integrations', organizationId, 'catalog-v1');
  await record('integration.disconnected', organizationId, existing.id, provider, actor);
}

function repository(organizationId: string) {
  return new IntegrationsRepository(resolveScope(organizationId));
}

function record(
  action: auditLog.AuditAction,
  organizationId: string,
  id: string,
  provider: string,
  actor: Actor,
) {
  return auditLog.record({
    action,
    actorId: actor.actorId,
    organizationId,
    entityType: 'integration',
    entityId: id,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    metadata: { provider },
  });
}
