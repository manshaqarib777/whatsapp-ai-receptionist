import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedId } from '../../prisma/seed/support';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('DemoPass!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/organization)/);
  if (email.endsWith('@northwind.test')) {
    expect(
      (
        await page.request.patch('/api/organizations/active', {
          data: { organizationId: seedId('org', 1) },
        })
      ).status(),
    ).toBe(200);
  }
}

test('owner manages a privacy export under a nonce-based CSP', async ({ page }) => {
  await signIn(page, 'owner@northwind.test');
  await page.goto('/settings/security');
  const policy =
    (await page.request.get('/settings/security')).headers()['content-security-policy'] ??
    '';
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toMatch(/'nonce-[^']+'/);
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  expect((await page.request.get('/api/privacy/requests')).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Privacy requests' })).toBeVisible();
  await page.getByRole('button', { name: 'Create request' }).click();
  await expect(page.getByText(/already pending|pending/i).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('member cannot see or call privacy administration', async ({ page }) => {
  await signIn(page, 'member@northwind.test');
  await page.goto('/settings/security');
  await expect(page.getByRole('heading', { name: 'Privacy requests' })).toHaveCount(0);
  expect((await page.request.get('/api/privacy/requests')).status()).toBe(403);
});
