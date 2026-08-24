export const INTEGRATION_PROVIDERS = [
  'meta',
  'google',
  'outlook',
  'slack',
  'hubspot',
  'stripe',
  'zapier',
  'make',
  'n8n',
  'salla',
  'shopify',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationDefinition = {
  provider: IntegrationProvider;
  name: string;
  description: string;
  capabilities: readonly string[];
  fields: readonly { key: string; label: string; placeholder: string }[];
};

export const INTEGRATION_CATALOG: readonly IntegrationDefinition[] = [
  {
    provider: 'meta',
    name: 'Meta',
    description: 'WhatsApp Business messaging and templates.',
    capabilities: ['messaging', 'templates', 'webhooks'],
    fields: [
      {
        key: 'businessAccountId',
        label: 'Business account ID',
        placeholder: 'demo-business-001',
      },
      { key: 'phoneNumberId', label: 'Phone number ID', placeholder: 'demo-phone-001' },
    ],
  },
  {
    provider: 'google',
    name: 'Google',
    description: 'Calendar availability and events.',
    capabilities: ['calendar', 'oauth'],
    fields: [
      { key: 'calendarId', label: 'Calendar ID', placeholder: 'appointments@demo.test' },
    ],
  },
  {
    provider: 'outlook',
    name: 'Outlook',
    description: 'Microsoft calendar availability and events.',
    capabilities: ['calendar', 'oauth'],
    fields: [
      { key: 'calendarId', label: 'Calendar ID', placeholder: 'appointments@demo.test' },
    ],
  },
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Team notifications and workflow updates.',
    capabilities: ['notifications', 'webhooks'],
    fields: [{ key: 'channelId', label: 'Channel ID', placeholder: 'C-DEMO-OPS' }],
  },
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'Contact, company, and deal synchronization.',
    capabilities: ['crm', 'oauth'],
    fields: [{ key: 'portalId', label: 'Portal ID', placeholder: 'demo-portal-001' }],
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Checkout, payment webhooks, and refunds.',
    capabilities: ['payments', 'webhooks'],
    fields: [{ key: 'accountId', label: 'Account ID', placeholder: 'acct_demo_001' }],
  },
  {
    provider: 'zapier',
    name: 'Zapier',
    description: 'Trigger external no-code automations.',
    capabilities: ['automation', 'webhooks'],
    fields: [
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://hooks.example.test/zapier/demo',
      },
    ],
  },
  {
    provider: 'make',
    name: 'Make',
    description: 'Trigger Make scenarios from business events.',
    capabilities: ['automation', 'webhooks'],
    fields: [
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://hooks.example.test/make/demo',
      },
    ],
  },
  {
    provider: 'n8n',
    name: 'n8n',
    description: 'Self-hosted workflow execution.',
    capabilities: ['automation', 'webhooks'],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://n8n.example.test' },
      { key: 'workflowId', label: 'Workflow ID', placeholder: 'demo-workflow' },
    ],
  },
  {
    provider: 'salla',
    name: 'Salla',
    description: 'Saudi commerce customer and order events.',
    capabilities: ['commerce', 'webhooks'],
    fields: [{ key: 'storeId', label: 'Store ID', placeholder: 'demo-salla-store' }],
  },
  {
    provider: 'shopify',
    name: 'Shopify',
    description: 'Store customer and order events.',
    capabilities: ['commerce', 'webhooks'],
    fields: [
      {
        key: 'storeDomain',
        label: 'Store domain',
        placeholder: 'demo-store.myshopify.com',
      },
    ],
  },
] as const;

export function getIntegrationDefinition(provider: string) {
  return INTEGRATION_CATALOG.find((item) => item.provider === provider) ?? null;
}
