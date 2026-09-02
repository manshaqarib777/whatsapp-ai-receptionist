import type { IntegrationProvider, PrismaClient } from '@prisma/client';
import type { SeededTenants } from './tenants';
import { SEED_NOW, seedId } from './support';

const DEMO_CONNECTIONS: Array<{
  provider: IntegrationProvider;
  config: Record<string, string>;
  enabled?: boolean;
}> = [
  {
    provider: 'meta',
    config: { businessAccountId: 'demo-business-001', phoneNumberId: 'demo-phone-001' },
  },
  { provider: 'google', config: { calendarId: 'appointments@northwind.test' } },
  {
    provider: 'outlook',
    config: { calendarId: 'reception@northwind.test' },
    enabled: false,
  },
  { provider: 'slack', config: { channelId: 'C-DEMO-OPS' } },
  { provider: 'hubspot', config: { portalId: 'demo-portal-001' } },
  { provider: 'stripe', config: { accountId: 'acct_demo_northwind' } },
  {
    provider: 'zapier',
    config: { webhookUrl: 'https://hooks.example.test/zapier/northwind' },
  },
  {
    provider: 'make',
    config: { webhookUrl: 'https://hooks.example.test/make/northwind' },
  },
  {
    provider: 'n8n',
    config: { baseUrl: 'https://n8n.example.test', workflowId: 'northwind-demo' },
  },
  { provider: 'salla', config: { storeId: 'demo-salla-store' } },
  { provider: 'shopify', config: { storeDomain: 'northwind-demo.myshopify.com' } },
];

export async function seedIntegrations(prisma: PrismaClient, tenants: SeededTenants) {
  for (const [index, connection] of DEMO_CONNECTIONS.entries()) {
    const enabled = connection.enabled ?? true;
    await prisma.integrationConnection.create({
      data: {
        id: seedId('integration', index + 1),
        organizationId: tenants.northwind.id,
        provider: connection.provider,
        mode: 'sandbox',
        config: connection.config,
        enabled,
        status: enabled ? 'connected' : 'disconnected',
        lastTestedAt: enabled ? SEED_NOW : null,
        lastHealthyAt: enabled ? SEED_NOW : null,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
  }
  await prisma.integrationConnection.create({
    data: {
      id: seedId('integration', 99),
      organizationId: tenants.beacon.id,
      provider: 'stripe',
      mode: 'sandbox',
      config: { accountId: 'acct_demo_beacon' },
      enabled: true,
      status: 'connected',
      lastTestedAt: SEED_NOW,
      lastHealthyAt: SEED_NOW,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  return { connectionCount: DEMO_CONNECTIONS.length + 1 };
}
