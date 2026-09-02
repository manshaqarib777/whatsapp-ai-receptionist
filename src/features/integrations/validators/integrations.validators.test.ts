import { describe, expect, it } from 'vitest';
import {
  integrationProviderSchema,
  parseIntegrationUpdate,
} from './integrations.validators';

describe('integration validators', () => {
  it('accepts every PRD provider', () => {
    for (const provider of [
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
    ]) {
      expect(integrationProviderSchema.parse(provider)).toBe(provider);
    }
  });
  it('uses strict provider-specific safe configuration', () => {
    expect(
      parseIntegrationUpdate('google', {
        enabled: true,
        mode: 'sandbox',
        config: { calendarId: 'demo@test.local' },
      }).config,
    ).toEqual({ calendarId: 'demo@test.local' });
    expect(() =>
      parseIntegrationUpdate('google', {
        enabled: true,
        mode: 'sandbox',
        config: { calendarId: 'demo', clientSecret: 'leak' },
      }),
    ).toThrow();
  });
  it('rejects insecure webhook URLs and malformed Shopify domains', () => {
    expect(() =>
      parseIntegrationUpdate('zapier', {
        enabled: true,
        mode: 'sandbox',
        config: { webhookUrl: 'http://example.test/hook' },
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      parseIntegrationUpdate('shopify', {
        enabled: true,
        mode: 'sandbox',
        config: { storeDomain: 'example.com' },
      }),
    ).toThrow();
  });
});
