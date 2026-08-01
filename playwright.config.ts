import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';

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
    command: 'npm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
