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

  /**
   * Session signing secret. A short secret is a weak secret — 32 characters is the
   * floor, and the app refuses to boot below it rather than running insecurely.
   */
  AUTH_SECRET: z
    .string()
    .min(
      32,
      'AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32',
    ),

  EMAIL_FROM: z.string().email().default('noreply@whatsapp-receptionist.local'),

  /**
   * How mail leaves the application.
   *
   * `smtp`  — a real SMTP connection through nodemailer. Works with any provider:
   *           Resend, Postmark, SES, Gmail, or a corporate relay.
   * `console` — writes the message to the terminal, with the link on its own line.
   *           Development convenience only; rejected in production, because
   *           silently discarding a password-reset email is worse than failing
   *           to boot.
   */
  EMAIL_TRANSPORT: z.enum(['smtp', 'console']).default('console'),

  SMTP_HOST: z.string().min(1).optional(),
  // 587 is STARTTLS, the default for nearly every provider. 465 is implicit TLS.
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /** TLS on connect (port 465). STARTTLS on 587 is negotiated automatically. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /**
   * Auth-endpoint rate limiting.
   *
   * Better Auth applies its own per-IP limiter to /api/auth/*. It is enabled by
   * default in production builds, which is easy to miss — configuring it here makes
   * it explicit and reviewable rather than an implicit library default.
   *
   * The E2E harness raises the ceiling because it deliberately generates signup
   * traffic that would otherwise look abusive. Production keeps the strict value.
   */
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  /**
   * Credential endpoints (sign-in, sign-up, change-password) get a much tighter
   * budget than general auth traffic — this is the credential-stuffing surface.
   * 5 per 10s per IP is generous for a human and hostile to a script.
   */
  AUTH_CREDENTIAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  /**
   * OAuth providers are optional. A provider is offered only when both its id and
   * secret are present; absent credentials must not break the app or the tests.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
});

/**
 * Client-exposed variables. These are inlined into the browser bundle, so nothing
 * secret may ever be added here. The NEXT_PUBLIC_ prefix is the guard rail.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
});

const envSchema = serverSchema.merge(clientSchema).superRefine((env, ctx) => {
  // A half-configured transport is the dangerous state: the app boots, users sign
  // up, and their verification mail goes nowhere. Catch it at startup instead.
  if (env.EMAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMTP_HOST'],
      message: 'SMTP_HOST is required when EMAIL_TRANSPORT=smtp.',
    });
  }

  // Credentials come as a pair or not at all.
  if (env.SMTP_USER && !env.SMTP_PASSWORD) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMTP_PASSWORD'],
      message: 'SMTP_PASSWORD is required when SMTP_USER is set.',
    });
  }

  if (env.SMTP_PASSWORD && !env.SMTP_USER) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMTP_USER'],
      message: 'SMTP_USER is required when SMTP_PASSWORD is set.',
    });
  }

  // Production must never fall back to writing account-critical mail to a log.
  if (env.NODE_ENV === 'production' && env.EMAIL_TRANSPORT !== 'smtp') {
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_TRANSPORT'],
      message:
        'EMAIL_TRANSPORT must be "smtp" in production. The console transport discards mail.',
    });
  }
});

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
