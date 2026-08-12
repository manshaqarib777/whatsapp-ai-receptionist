import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// `toHaveNoViolations`, used by every component test. Accessibility is a build
// failure here rather than a review comment (.claude/ACCESSIBILITY_RULES.md).
expect.extend(axeMatchers);

/**
 * `findBy*` and `waitFor` default to a 1s budget, which is not enough while the
 * full suite saturates every core: a mocked promise resolves, but React does not
 * flush the resulting state before the budget expires. That produced genuinely
 * flaky auth component tests — passing alone, failing in the suite — and
 * `.claude/TESTING_RULES.md:118` requires flakes fixed rather than retried.
 *
 * This widens the budget for a slow machine; it does not weaken an assertion.
 * A real regression still fails, only later. `testTimeout` (vitest.config.ts)
 * stays above this so the per-test timeout is not what trips first.
 */
configure({ asyncUtilTimeout: 5_000 });

// Tests must be independent and order-agnostic (.claude/TESTING_RULES.md).
afterEach(() => {
  cleanup();
});

/**
 * jsdom implements neither of these, and Radix uses both for popovers, dialogs, and
 * the command palette. Without them every overlay test dies inside Radix rather than
 * on its own assertion.
 */
if (typeof window !== 'undefined') {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};

  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
