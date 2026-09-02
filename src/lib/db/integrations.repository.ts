import type { IntegrationProvider, IntegrationStatus, Prisma } from '@prisma/client';
import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';

const SAFE_SELECT = {
  id: true,
  provider: true,
  status: true,
  enabled: true,
  mode: true,
  config: true,
  credentialHint: true,
  lastTestedAt: true,
  lastHealthyAt: true,
  lastError: true,
  version: true,
  updatedAt: true,
} as const;

export class IntegrationsRepository {
  private readonly db;
  private readonly all;
  private readonly organizationId;
  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.all = forScope(scope, { includeDeleted: true });
    this.organizationId = scope.organizationId;
  }
  list() {
    return this.db.integrationConnection.findMany({
      select: SAFE_SELECT,
      orderBy: { provider: 'asc' },
    });
  }
  find(provider: IntegrationProvider) {
    return this.db.integrationConnection.findFirst({
      where: { provider },
      select: SAFE_SELECT,
    });
  }
  async save(
    provider: IntegrationProvider,
    input: {
      enabled: boolean;
      mode: string;
      config: Prisma.InputJsonValue;
      version?: number;
      credentialCiphertext?: string;
      credentialHint?: string;
      credentialKeyVersion?: number;
    },
  ) {
    const existing = await this.all.integrationConnection.findFirst({
      where: { provider },
      select: { id: true, version: true },
    });
    if (existing && input.version !== existing.version) return null;
    if (!existing) {
      return this.db.integrationConnection.create({
        data: {
          organizationId: this.organizationId,
          provider,
          enabled: input.enabled,
          mode: input.mode,
          config: input.config,
          credentialCiphertext: input.credentialCiphertext,
          credentialHint: input.credentialHint,
          credentialKeyVersion: input.credentialKeyVersion,
        },
        select: SAFE_SELECT,
      });
    }
    await this.all.integrationConnection.updateMany({
      where: { id: existing.id },
      data: {
        enabled: input.enabled,
        mode: input.mode,
        config: input.config,
        deletedAt: null,
        credentialCiphertext: input.credentialCiphertext,
        credentialHint: input.credentialHint,
        credentialKeyVersion: input.credentialKeyVersion,
        status: 'disconnected',
        lastError: null,
        version: { increment: 1 },
      },
    });
    return this.find(provider);
  }
  async recordTest(
    provider: IntegrationProvider,
    input: { status: IntegrationStatus; testedAt: Date; error: string | null },
  ) {
    const result = await this.db.integrationConnection.updateMany({
      where: { provider },
      data: {
        status: input.status,
        lastTestedAt: input.testedAt,
        lastHealthyAt: input.status === 'connected' ? input.testedAt : undefined,
        lastError: input.error,
        version: { increment: 1 },
      },
    });
    return result.count ? this.find(provider) : null;
  }
  disconnect(provider: IntegrationProvider) {
    return this.db.integrationConnection.updateMany({
      where: { provider },
      data: {
        deletedAt: new Date(),
        enabled: false,
        status: 'disconnected',
        version: { increment: 1 },
      },
    });
  }
}
