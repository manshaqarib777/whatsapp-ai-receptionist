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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import the shared client from "@/lib/prisma". Only repositories may access the database (.claude/ARCHITECTURE_RULES.md §3).',
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

  /* src/lib/prisma.ts is the module that constructs the client. */
  {
    files: ['src/lib/prisma.ts'],
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
