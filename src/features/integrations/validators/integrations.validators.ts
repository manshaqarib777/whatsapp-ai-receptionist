import { z } from 'zod';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '../services/catalog';

export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
const value = z.string().trim().min(1).max(300);
const url = z
  .url()
  .max(500)
  .refine((candidate) => candidate.startsWith('https://'), 'Use an HTTPS URL.');

const configs: Record<IntegrationProvider, z.ZodType<Record<string, string>>> = {
  meta: z.object({ businessAccountId: value, phoneNumberId: value }).strict(),
  google: z.object({ calendarId: value }).strict(),
  outlook: z.object({ calendarId: value }).strict(),
  slack: z.object({ channelId: value }).strict(),
  hubspot: z.object({ portalId: value }).strict(),
  stripe: z.object({ accountId: value }).strict(),
  zapier: z.object({ webhookUrl: url }).strict(),
  make: z.object({ webhookUrl: url }).strict(),
  n8n: z.object({ baseUrl: url, workflowId: value }).strict(),
  salla: z.object({ storeId: value }).strict(),
  shopify: z
    .object({ storeDomain: value.regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i) })
    .strict(),
};

export const integrationUpdateSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(['sandbox', 'live']),
    config: z.record(z.string(), z.unknown()),
    credential: z.string().trim().min(8).max(4096).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();

export function parseIntegrationUpdate(provider: IntegrationProvider, input: unknown) {
  const base = integrationUpdateSchema.parse(input);
  return { ...base, config: configs[provider].parse(base.config) };
}
