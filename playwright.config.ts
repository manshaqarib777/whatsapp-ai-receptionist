import { defineConfig, devices } from '@playwright/test';

/**
 * Port 3100, NOT 3000.
 *
 * The dev server owns 3000. Sharing the port meant `reuseExistingServer` would adopt
 * whichever server happened to be there — and a dev server serves different markup
 * (the Next dev-tools overlay is focusable, which broke an accessibility assertion).
 * The workaround was to kill the dev server before every test run, which is hostile
 * to anyone actually developing.
 *
 * On its own port, the suite always starts its own production build and `npm run dev`
 * can stay up indefinitely.
 */
const E2E_PORT = process.env['PLAYWRIGHT_PORT'] ?? '3100';
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${E2E_PORT}`;

/**
 * E2E configuration.
 *
 * `retries: 0` locally and in CI is deliberate: .claude/TESTING_RULES.md forbids
 * retrying a flaky test into passing. A flaky test is fixed or deleted.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run start -- --port ${E2E_PORT}`,
    url: BASE_URL,
    // Never adopt a server we did not start. On a dedicated port there is nothing
    // legitimate to reuse, and adopting a stray process is how a suite ends up
    // silently testing the wrong build.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Playwright REPLACES the environment rather than merging, so the base
      // configuration has to be carried through explicitly — without this the
      // server boots with no DATABASE_URL and every test fails for the wrong reason.
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined),
      ) as Record<string, string>),

      // Tests must NEVER send real email. Without this the suite inherits whatever
      // provider .env points at and tries to deliver to @test.local addresses —
      // which a real provider rejects, failing signup for the wrong reason, and
      // which would send genuine mail if the addresses happened to be real.
      // The test server genuinely runs on E2E_PORT, and the auth layer rejects
      // browser requests whose Origin does not match its configured base URL —
      // a CSRF protection. Tell it the truth rather than loosening the check.
      NEXT_PUBLIC_APP_URL: BASE_URL,

      EMAIL_TRANSPORT: 'console',
      // Permits the console transport against a production BUILD. See src/lib/env.ts.
      E2E_TEST_RUN: 'true',

      // The suite deliberately generates signup traffic that would otherwise look
      // abusive to the per-IP limiter. Raising the ceiling HERE keeps production
      // strict rather than weakening the application to suit its tests.
      AUTH_RATE_LIMIT_MAX: '1000',
      AUTH_CREDENTIAL_RATE_LIMIT_MAX: '1000',
    },
  },
});
