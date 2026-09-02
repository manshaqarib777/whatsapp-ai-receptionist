import { expect, test } from '@playwright/test';

/**
 * Milestone 1 E2E — proves the foundation works in a real browser against a
 * production build, not just in jsdom.
 */

test.describe('application shell', () => {
  test('loads and reports system status', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'WhatsApp AI Receptionist' }),
    ).toBeVisible();
    await expect(page.getByText('Operational')).toBeVisible();
    await expect(page.getByText('Connected', { exact: true }).first()).toBeVisible();
  });

  test('serves a 404 page for an unknown route', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('health endpoint', () => {
  test('returns 200 with the documented envelope', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const payload = (await response.json()) as {
      data: { status: string; checks: { database: string; redis: string } };
    };

    expect(payload.data.status).toBe('ok');
    expect(payload.data.checks.database).toBe('ok');
    expect(payload.data.checks.redis).toBe('ok');
  });

  test('returns a correlation id header', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.headers()['x-correlation-id']).toBeTruthy();
  });
});

test.describe('security headers', () => {
  test('sets the required headers on every response', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['strict-transport-security']).toContain('max-age=');
  });

  test('does not advertise the framework', async ({ request }) => {
    const response = await request.get('/');

    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});

test.describe('accessibility', () => {
  test('does not trap keyboard focus', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Operational')).toBeVisible();

    const focusableCount = await page
      .locator(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      .count();

    // Tripwire, not a weak assertion: the Milestone 1 scaffold page deliberately
    // has no interactive controls in its success state (the design system is
    // Milestone 3). When the first control is added this test FAILS, forcing a
    // real focus-order and focus-ring assertion to be written rather than
    // silently inheriting a check that proves nothing.
    expect(focusableCount).toBe(0);

    await page.keyboard.press('Tab');

    const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(activeTag).toBe('BODY');
  });

  test('has exactly one h1 and a document title', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(/WhatsApp AI Receptionist/);
  });

  test('sets the document language', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('responsive', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1440, height: 900 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'ultra-wide', width: 2560, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`renders without horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByText('Operational')).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

      expect(hasOverflow).toBe(false);
    });
  }
});
