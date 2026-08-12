import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { DESIGN_BASE_URL } from '../../playwright.config';

/**
 * Gallery E2E.
 *
 * The component tests prove each piece in isolation. This proves the system holds up
 * assembled — in both themes, both directions, and at real viewport sizes, which is
 * where token, contrast, and layout mistakes actually surface.
 *
 * Two servers are in play (see playwright.config.ts), both from the same production
 * build: the gallery specs run against the one started with `DESIGN_GALLERY=enabled`,
 * and the default one is used to assert that `/design` 404s without it.
 */

const GALLERY = `${DESIGN_BASE_URL}/design`;

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

/**
 * The gallery renders every component in the system on one page, so an axe run
 * over it costs 14–21s even on an idle machine — against a 30s default that left
 * no headroom, and that tipped over as soon as the suite ran more than one worker.
 * `retries: 0` (playwright.config.ts) means a flake here is a red build, and
 * `.claude/TESTING_RULES.md:118` requires it fixed rather than retried, so the
 * audits get a budget that matches what they actually cost. The audit itself is
 * unchanged — this widens the clock, not the pass condition.
 */
const AUDIT_TIMEOUT_MS = 90_000;

async function openGallery(page: Page, theme: 'light' | 'dark') {
  // Set the theme before the first paint, the same way the stored preference is
  // applied in real use — this is also what proves there is no flash to fix.
  await page.addInitScript((value) => {
    window.localStorage.setItem('theme', value);
  }, theme);

  /**
   * Audit the settled interface, not the entrance.
   *
   * Entrance animations fade opacity from 0, and a contrast check that lands
   * mid-fade measures a blended colour — which made the audit intermittently
   * report a failure that no user could ever see. Under reduced motion the
   * entrances resolve immediately, so what axe measures is the final rendering.
   * That the components honour this preference is asserted separately, in
   * `motion-section` and in the component tests.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto(GALLERY);
  await expect(
    page.getByRole('heading', { name: 'Design System', level: 1 }),
  ).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`gallery — ${theme}`, () => {
    test(`applies the ${theme} theme before paint`, async ({ page }) => {
      await openGallery(page, theme);

      const className = await page.locator('html').getAttribute('class');

      expect(className?.includes('dark')).toBe(theme === 'dark');
    });

    test(`has no accessibility violations in ${theme}`, async ({ page }) => {
      test.setTimeout(AUDIT_TIMEOUT_MS);
      await openGallery(page, theme);

      const results = await audit(page);

      expect(results.violations).toEqual([]);
    });

    test(`has no accessibility violations in ${theme}, right to left`, async ({
      page,
    }) => {
      test.setTimeout(AUDIT_TIMEOUT_MS);
      await openGallery(page, theme);
      await page.getByRole('button', { name: /right-to-left/i }).click();

      const results = await audit(page);

      expect(results.violations).toEqual([]);
    });
  });
}

test.describe('gallery — responsive', () => {
  const VIEWPORTS = [
    { name: 'phone', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'desktop', width: 1536, height: 960 },
    { name: 'wide', width: 1920, height: 1080 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`renders without horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openGallery(page, 'light');

      // A page that scrolls sideways on a phone is the single most common responsive
      // failure, and it is invisible on a desktop while developing.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('gallery — keyboard', () => {
  test('opens and closes the command palette with the keyboard alone', async ({
    page,
  }) => {
    await openGallery(page, 'light');

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();

    // Focus must land in the palette, not stay behind it.
    await expect(palette.getByRole('combobox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('traps focus inside a dialog and returns it to the trigger', async ({ page }) => {
    await openGallery(page, 'light');

    const trigger = page.getByRole('button', { name: 'Dialog' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: /delete conversation/i });
    await expect(dialog).toBeVisible();

    // Tab all the way round: focus must never leave the dialog.
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      const insideDialog = await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      );
      expect(insideDialog).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Returning focus to the trigger is what stops a keyboard user being dumped at
    // the top of the page after every dialog.
    await expect(trigger).toBeFocused();
  });

  test('operates the sidebar and reports the current page', async ({ page }) => {
    await openGallery(page, 'light');

    const nav = page.getByRole('navigation', { name: 'Main' }).first();
    await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible();

    await expect(nav).toHaveAttribute('data-collapsed', 'false');

    await nav.getByRole('button', { name: 'Collapse sidebar' }).click();

    await expect(nav).toHaveAttribute('data-collapsed', 'true');
    // Collapsed, the visible labels are gone but every destination keeps its name.
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows a visible focus ring on the first interactive element', async ({
    page,
  }) => {
    await openGallery(page, 'light');

    await page.keyboard.press('Tab');

    // `outline: none` with nothing in its place is the most common keyboard failure
    // in a "clean-looking" design system.
    const hasVisibleIndicator = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;

      const style = getComputedStyle(active);

      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none' ||
        Number.parseFloat(style.outlineWidth) > 0
      );
    });

    expect(hasVisibleIndicator).toBe(true);
  });
});

test.describe('gallery — console', () => {
  test('renders with no page errors, including hydration mismatches', async ({
    page,
  }) => {
    /**
     * This catches a whole class of defect that looks fine on screen. Invalid nesting
     * — an <li> inside an <li>, say — makes the browser silently reshuffle the markup,
     * React then disagrees with what it rendered on the server, and it throws away
     * that subtree and rebuilds it on the client. Nothing looks wrong; the interface
     * is just slower and, in the worst case, momentarily inert.
     */
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await openGallery(page, 'light');
    // Hydration happens after first paint, so give it a beat to complain.
    await page.waitForTimeout(1_000);

    const relevant = errors.filter(
      // Ignore network noise from the environment (blocked fonts, missing favicon).
      (message) => !/Failed to load resource|net::ERR/i.test(message),
    );

    expect(relevant).toEqual([]);
  });
});

test.describe('gallery — direction', () => {
  test('flips the layout to RTL without a reload', async ({ page }) => {
    await openGallery(page, 'light');

    await page.getByRole('button', { name: /right-to-left/i }).click();

    await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
  });
});

test.describe('design gallery in production', () => {
  test('404s, so it can never be reached by a user', async ({ page }) => {
    // This one runs against the production build on the default baseURL. The gallery
    // is a development tool; in production it must not exist.
    const response = await page.goto('/design');

    expect(response?.status()).toBe(404);
  });
});
