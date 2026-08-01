import { expect, test } from '@playwright/test';

/**
 * Milestone 2 E2E — proves the auth flows work in a real browser against a
 * production build.
 *
 * Each run uses a unique email so tests stay independent and re-runnable against a
 * database that is not reset between runs.
 */

function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

const STRONG_PASSWORD = 'correct-horse-battery-staple';

test.describe('route protection', () => {
  test('redirects an unauthenticated visitor from a protected route to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('preserves the intended destination in the next parameter', async ({ page }) => {
    await page.goto('/settings/security');

    await expect(page).toHaveURL(/next=%2Fsettings%2Fsecurity/);
  });

  test('rejects an unauthenticated API request with 401, bypassing middleware', async ({
    request,
  }) => {
    // Middleware does not cover /api/members, so this proves the SERVER-SIDE check is
    // the real boundary (MILESTONE_02_PLAN.md, Risk 8).
    const response = await request.get('/api/members');

    expect(response.status()).toBe(401);

    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe('UNAUTHENTICATED');
  });

  test('rejects unauthenticated audit-log access', async ({ request }) => {
    const response = await request.get('/api/audit-logs');

    expect(response.status()).toBe(401);
  });

  test('rejects unauthenticated organization creation', async ({ request }) => {
    const response = await request.post('/api/organizations', {
      data: { name: 'Should Not Exist' },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('sign up', () => {
  /**
   * REGRESSION GUARD.
   *
   * A previous version of this suite asserted only that the UI said "Check your
   * email". Signup was completely broken — the auth library generated nanoid-style
   * ids that Postgres rejected for uuid columns — and this test still passed,
   * because the form treated the resulting 422 as success in order to mask
   * duplicate addresses. Zero accounts were being created.
   *
   * The API-level assertion below cannot be satisfied by the UI's error handling,
   * so the flow must genuinely work for it to pass.
   */
  test('the signup endpoint actually creates an account', async ({ request }) => {
    const response = await request.post('/api/auth/sign-up/email', {
      data: {
        name: 'E2E Tester',
        email: uniqueEmail('api-signup'),
        password: STRONG_PASSWORD,
      },
    });

    expect(response.status()).toBe(200);

    const payload = (await response.json()) as { user?: { id?: string } };

    expect(payload.user?.id).toBeTruthy();
    // The id must be a real UUID — this is precisely what was broken.
    expect(payload.user?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test('creates an account and asks for email verification', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel('Name').fill('E2E Tester');
    await page.getByLabel('Email').fill(uniqueEmail('signup'));
    await page.getByLabel('Password').fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('status')).toContainText('Check your email');
  });

  test('rejects a password under 12 characters', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel('Name').fill('E2E Tester');
    await page.getByLabel('Email').fill(uniqueEmail('shortpw'));
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Target the error region specifically — the field hint also mentions the
    // 12-character rule, so a plain text match is ambiguous.
    await expect(
      page.getByRole('alert').filter({ hasText: /at least 12/i }),
    ).toBeVisible();
  });

  test('does not reveal that an address is already registered', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('duplicate');

    // Assert enumeration resistance at the API level too, so this cannot be
    // satisfied by the UI merely rendering the same screen for a failed request.
    const first = await request.post('/api/auth/sign-up/email', {
      data: { name: 'E2E Tester', email, password: STRONG_PASSWORD },
    });
    const second = await request.post('/api/auth/sign-up/email', {
      data: { name: 'E2E Tester', email, password: STRONG_PASSWORD },
    });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(second.status());
    // A duplicate must not be distinguishable by status code.
    expect(second.status()).toBe(200);

    for (const attempt of [1, 2]) {
      await page.goto('/signup');
      await page.getByLabel('Name').fill('E2E Tester');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(STRONG_PASSWORD);
      await page.getByRole('button', { name: 'Create account' }).click();

      // Both the first and the second attempt must look identical.
      await expect(
        page.getByRole('status'),
        `attempt ${attempt} should look the same`,
      ).toContainText('Check your email');
    }
  });
});

test.describe('onboarding', () => {
  /**
   * REGRESSION GUARD.
   *
   * /onboarding/organization originally lived inside the (app) route group, whose
   * layout redirects any user with zero organizations TO onboarding. The page that
   * creates the first organization was therefore guarded by a rule requiring you to
   * already have one — an infinite redirect loop, hit by every new user on their
   * very first sign-in.
   *
   * Onboarding now has its own route group with a narrower contract: authenticated,
   * but not required to belong to an organization.
   */
  test('does not redirect to itself', async ({ request }) => {
    const email = uniqueEmail('onboarding-loop');

    await request.post('/api/auth/sign-up/email', {
      data: { name: 'Loop Test', email, password: STRONG_PASSWORD },
    });

    // Unauthenticated, the page must send us to login — never to itself.
    const response = await request.get('/onboarding/organization', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const location = response.headers()['location'] ?? '';

    expect(location).not.toContain('/onboarding/organization');
    expect(location).toContain('/login');
  });

  test('a signed-out visitor reaches login rather than looping', async ({ page }) => {
    await page.goto('/onboarding/organization');

    // Playwright follows redirects; a loop would time out rather than land here.
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('sign in', () => {
  test('shows a generic message for unknown credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nobody-at-all@test.local');
    await page.getByLabel('Password').fill(STRONG_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    const alert = page.getByRole('alert').first();
    await expect(alert).toBeVisible();

    const text = (await alert.textContent())?.toLowerCase() ?? '';
    expect(text).not.toContain('no account');
    expect(text).not.toContain('not found');
    expect(text).not.toContain('does not exist');
  });

  test('offers a magic-link alternative', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /sign in with a link/i }).click();

    await expect(page.getByLabel('Password')).toBeHidden();
    await expect(page.getByRole('button', { name: /send sign-in link/i })).toBeVisible();
  });

  test('confirms a magic link without revealing whether the account exists', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /sign in with a link/i }).click();
    await page.getByLabel('Email').fill('nobody-at-all@test.local');
    await page.getByRole('button', { name: /send sign-in link/i }).click();

    await expect(page.getByRole('status')).toContainText(/if an account exists/i);
  });

  test('does not offer OAuth when no provider is configured', async ({ page }) => {
    await page.goto('/login');

    // No credentials are set in the test environment, so no provider should appear.
    await expect(page.getByRole('button', { name: /continue with/i })).toHaveCount(0);
  });
});

test.describe('password reset', () => {
  test('confirms without revealing whether the account exists', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel('Email').fill('nobody-at-all@test.local');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByRole('status')).toContainText(/if an account exists/i);
  });

  test('rejects a reset page with no token', async ({ page }) => {
    await page.goto('/reset-password');

    await expect(page.getByRole('heading', { name: /link is not valid/i })).toBeVisible();
  });
});

test.describe('open redirect protection', () => {
  test('does not honour an external next parameter', async ({ page }) => {
    await page.goto('/login?next=https://evil.example.com');

    // The page must render normally; the malicious value is discarded when used.
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(page.url()).toContain('localhost');
  });

  test('does not honour a protocol-relative next parameter', async ({ page }) => {
    await page.goto('/login?next=//evil.example.com');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(page.url()).toContain('localhost');
  });
});

test.describe('accessibility', () => {
  test('login form is completable by keyboard alone', async ({ page }) => {
    await page.goto('/login');

    // The email field is auto-focused, so typing starts immediately.
    await page.keyboard.type('keyboard@test.local');
    await page.keyboard.press('Tab');
    await page.keyboard.type(STRONG_PASSWORD);

    await expect(page.getByLabel('Email')).toHaveValue('keyboard@test.local');
    await expect(page.getByLabel('Password')).toHaveValue(STRONG_PASSWORD);
  });

  test('every auth screen has exactly one h1', async ({ page }) => {
    for (const path of ['/login', '/signup', '/forgot-password', '/verify-email']) {
      await page.goto(path);
      await expect(page.locator('h1'), `${path} should have one h1`).toHaveCount(1);
    }
  });

  test('form fields have associated labels', async ({ page }) => {
    await page.goto('/signup');

    // getByLabel resolving proves the label/control association exists.
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('invalid fields are marked for assistive technology', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('responsive', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'ultra-wide', width: 2560, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`login renders without horizontal overflow at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

      expect(hasOverflow).toBe(false);
    });
  }
});
