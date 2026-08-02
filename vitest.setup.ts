import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// `toHaveNoViolations`, used by every component test. Accessibility is a build
// failure here rather than a review comment (.claude/ACCESSIBILITY_RULES.md).
expect.extend(axeMatchers);

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
