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

  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.')
    .optional(),

  REDIS_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
      'REDIS_URL must use redis:// or rediss://.',
    )
    .optional(),
  APP_URL: z.string().url('APP_URL must be a valid URL').optional(),
  CACHE_PREFIX: z
    .string()
    .regex(/^[a-z0-9_-]+$/i)
    .default('war'),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(30),

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
   * Marks an automated end-to-end run against a local production BUILD, which is not
   * a production DEPLOYMENT.
   *
   * Its only effect is to permit the console email transport, so the suite never
   * sends real mail. Nothing else relaxes. A genuine deployment that sets this is
   * announcing it wants mail discarded — so boot logs a warning loudly enough that
   * nobody does it by accident.
   */
  E2E_TEST_RUN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /**
   * Serves the design-system gallery at `/design` from a production BUILD.
   *
   * The gallery is a development tool. It is always available in development, and in
   * a production build it 404s unless this is explicitly set — which only the E2E
   * suite does, so it can audit the real production markup rather than the
   * development server's (whose injected dev toolbar is not ours to make accessible).
   *
   * A deployment must never set it. It exposes no data and reaches no API, but it is
   * not a product surface and has no business being reachable.
   */
  DESIGN_GALLERY: z
    .enum(['enabled', 'disabled'])
    .default('disabled')
    .transform((value) => value === 'enabled'),

  /**
   * Local object-storage directory for message attachments (AD-6).
   *
   * The schema stores a `storage_key`, never a blob, so the blob lives wherever
   * this points. Local development writes under `./storage` (gitignored); a
   * production deployment swaps in real object storage behind the same
   * `src/lib/storage.ts` interface.
   */
  STORAGE_DIR: z.string().min(1).default('./storage'),

  /**
   * Embedding provider for the knowledge base (Milestone 7, AD-2).
   *
   * `openai` — text-embedding-3-small (1536-dim, matches the schema's
   * `vector(1536)`). Requires OPENAI_API_KEY.
   * `local` — a deterministic hash embedder. No key, unit-testable, used by the
   * test suite and seed so they never depend on an external service. Vectors are
   * NOT semantically meaningful — the real key is required for live ingestion.
   */
  EMBEDDING_PROVIDER: z.enum(['openai', 'local']).default('local'),
  EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  OPENAI_API_KEY: z.string().min(1).optional(),

  /**
   * LLM provider for the AI Engine (Milestone 8, AD-2).
   *
   * `openai` — chat completions via the OpenAI SDK. Requires OPENAI_API_KEY.
   * `local` — a deterministic rule-based provider. No key, unit-testable, used
   * by the test suite and seed. Answers are NOT semantically rich — the real
   * provider is required for live replies. Per-turn `ai_runs` record the
   * "provider/model" string so a switch is a documented decision with an eval.
   */
  LLM_PROVIDER: z.enum(['openai', 'local']).default('local'),
  LLM_CLASSIFY_MODEL: z.string().min(1).default('anthropic/claude-haiku-4-5'),
  LLM_REPLY_MODEL: z.string().min(1).default('anthropic/claude-sonnet-5'),

  /**
   * OAuth providers are optional. A provider is offered only when both its id and
   * secret are present; absent credentials must not break the app or the tests.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Payment gateways (Milestone 12). Stripe keys are optional: absent keys
   * degrade the adapter to `configured: false`, and the service refuses with a
   * clear error instead of a silent no-op. Secrets never reach the client.
   */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  INTEGRATIONS_LIVE_ENABLED: z.enum(['true', 'false']).default('false'),
  SPEECH_PROVIDER: z.enum(['local', 'openai']).default('local'),
  SPEECH_TO_TEXT_MODEL: z.string().min(1).default('gpt-4o-mini-transcribe'),
  TEXT_TO_SPEECH_MODEL: z.string().min(1).default('gpt-4o-mini-tts'),
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

  // The OpenAI embedding provider is unusable without its key; fail at boot
  // rather than at the first ingestion.
  if (env.EMBEDDING_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['OPENAI_API_KEY'],
      message: 'OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.',
    });
  }
  if (env.SPEECH_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['OPENAI_API_KEY'],
      message: 'OPENAI_API_KEY is required when SPEECH_PROVIDER=openai.',
    });
  }

  // Production must never fall back to writing account-critical mail to a log.
  // E2E_TEST_RUN exempts an automated run against a local production build.
  if (
    env.NODE_ENV === 'production' &&
    env.EMAIL_TRANSPORT !== 'smtp' &&
    !env.E2E_TEST_RUN
  ) {
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

/**
 * Whether `/design` is served. Development always; a production build only when
 * `DESIGN_GALLERY=enabled` is set explicitly, which only the E2E suite does.
 */
export const isDesignGalleryEnabled = !isProduction || env.DESIGN_GALLERY;
