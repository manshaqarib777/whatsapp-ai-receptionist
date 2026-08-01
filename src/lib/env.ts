import { z } from 'zod';

/**
 * Environment validation.
 *
 * This is the ONLY module permitted to read `process.env` — enforced by the
 * `no-restricted-properties` ESLint rule. Everything else imports `env` from here
 * and gets typed, guaranteed-present values.
 *
 * Validation runs at module load, so a misconfigured deployment fails fast and
 * loudly at boot rather than at 3am on the first request that happens to need the
 * missing variable.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must be a postgresql:// connection string',
    ),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

/**
 * Client-exposed variables. These are inlined into the browser bundle, so nothing
 * secret may ever be added here. The NEXT_PUBLIC_ prefix is the guard rail.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
});

const envSchema = serverSchema.merge(clientSchema);

export type Env = z.infer<typeof envSchema>;

/**
 * Formats a Zod error into an operator-readable message that names every offending
 * variable. A deployment failure should tell you exactly what to fix.
 */
function formatEnvError(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  return `Invalid environment configuration:\n${issues}\n\nSee .env.example for the required variables.`;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}

// This module is the single sanctioned reader of process.env; the ESLint
// override for this file lives in eslint.config.mjs.
export const env: Env = parseEnv(process.env);

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
