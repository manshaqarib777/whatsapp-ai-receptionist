import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/**
 * Lint configuration.
 *
 * `npm run lint` must return 0 errors AND 0 warnings (PRD). Rules here are
 * therefore set to "error" rather than "warn" — a warning nobody can ship with is
 * just an error with extra steps.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/generated/**',
  ]),

  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      /* --- Type safety (.claude/CODING_STANDARDS.md) --- */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      /* --- Forbidden patterns --- */
      // Use the structured logger, never console.
      'no-console': 'error',
      // process.env is read only in src/lib/env.ts, which opts out explicitly.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration from "@/lib/env" instead. src/lib/env.ts is the only sanctioned reader of process.env.',
        },
      ],
      /* Both the raw client and the unscoped shared client are off-limits outside
         the database layer. Milestone 4's tenant isolation (AD-2) is enforced by
         the client extension in src/lib/db/scoped-prisma.ts, and a feature that
         imports the unscoped client simply steps around it — so the boundary has
         to be a lint error, not a convention. The sanctioned unscoped callers are
         allow-listed by path below, which keeps the list short, explicit, and
         reviewable. */
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Only the database layer may touch Prisma directly. Take a Scope and use forScope() from "@/lib/db/scoped-prisma" (.claude/ARCHITECTURE_RULES.md §3, .claude/DATABASE_RULES.md → Multi-Tenancy).',
            },
            {
              name: '@/lib/prisma',
              message:
                'This client is UNSCOPED — queries through it can return another tenant\'s rows. Use forScope() from "@/lib/db/scoped-prisma" instead (.claude/DATABASE_RULES.md → Multi-Tenancy).',
            },
          ],
        },
      ],

      /* --- RTL: logical properties only (RTL_I18N_RULES.md) ---
         Arabic is a first-class locale for this product (the Gulf payment
         providers in Milestone 12 make that explicit). Physical direction
         utilities do not flip, so they must not reach the codebase at all —
         convention alone will not hold across twenty features. */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] > Literal[value=/(^|\\s|:)(p[lr]|m[lr]|left|right|border-[lr]|rounded-[lr]|text-(left|right)|float-(left|right)|inset-[lr])-/]",
          message:
            'Use logical properties so RTL works: ps-/pe-, ms-/me-, start-/end-, border-s/border-e, text-start/text-end. See .claude/RTL_I18N_RULES.md.',
        },
      ],

      /* --- Correctness --- */
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-param-reassign': 'error',
      'object-shorthand': 'error',
    },
  },

  /* src/lib/env.ts is the single sanctioned reader of process.env. */
  {
    files: ['src/lib/env.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  /* src/lib/prisma.ts constructs the client; src/lib/db/ IS the database layer —
     it reads the Prisma DMMF to derive which models are tenant-scoped, which is
     what stops that registry drifting as tables are added (Milestone 4, AD-2). */
  {
    files: ['src/lib/prisma.ts', 'src/lib/db/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  /* The sanctioned unscoped callers. Each one runs BEFORE a tenant scope exists,
     so it cannot use forScope() by definition — this is not a grandfather clause
     for convenience. Adding a file here is a security decision and needs a reason
     in review; a feature module never belongs in this list.

       lib/auth.ts              Better Auth's adapter owns its own tables.
       server/auth-context.ts   Resolves session -> organization; derives the scope.
       auth/organization.service.ts  Creates orgs and reads membership, which is
                                what a scope is built from.
       auth/audit-log.service.ts     Pre-dates the extension; takes organizationId
                                as a required argument and filters on it.
       health/health.service.ts      `SELECT 1` liveness probe, touches no tenant row.
       knowledge/lib/retrieval.ts    Raw-SQL pgvector seam (M7 AD-6): every statement
                                self-scopes from the Scope argument, because the
                                scoped extension cannot inject into raw SQL.
       invoices/services/webhook.ts  Payment webhook entry (M12): runs BEFORE a
                                tenant scope exists — the gateway verifies via its
                                own signature and the owning org is derived from a
                                globally-unique gatewayPaymentId, so the lookup
                                cannot return another tenant's row. */
  {
    files: [
      'src/lib/auth.ts',
      'src/server/auth-context.ts',
      'src/features/auth/services/organization.service.ts',
      'src/features/auth/services/audit-log.service.ts',
      'src/features/health/services/health.service.ts',
      'src/features/knowledge/lib/retrieval.ts',
      'src/features/invoices/services/webhook.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },

  /* Config files and scripts run outside the app runtime. */
  {
    files: [
      '*.config.{ts,mts,js,mjs}',
      'prisma.config.ts',
      'prisma/**/*.ts',
      'scripts/**/*.ts',
    ],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },

  /* Tests may reach for the client directly and log freely. */
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}', '**/test-utils/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
      'no-console': 'off',
    },
  },
]);

export default eslintConfig;
