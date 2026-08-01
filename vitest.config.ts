import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Unit, integration, and component tests.
 *
 * E2E lives in Playwright (playwright.config.ts) and is excluded here — running
 * Playwright specs under Vitest produces confusing failures.
 */
export default defineConfig({
  plugins: [react()],
  // Path aliases (@/*) resolve natively from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    /**
     * Test configuration is declared here rather than read from a .env file, so
     * runs are deterministic and identical on every machine and in CI. Only
     * DATABASE_URL is overridable — CI points it at its own service container.
     */
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://war_dev:war_dev_password@localhost:5433/war_dev?schema=public',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      LOG_LEVEL: 'error',
    },
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/app/**/layout.tsx',
        'src/app/**/*error.tsx',
        'src/app/**/not-found.tsx',
      ],
      thresholds: {
        // .claude/TESTING_RULES.md: 90% on lib/services.
        'src/lib/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
      },
    },
  },
});
