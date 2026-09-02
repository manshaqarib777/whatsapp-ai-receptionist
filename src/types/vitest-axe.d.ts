import type { AxeMatchers } from 'vitest-axe/matchers';

/**
 * `toHaveNoViolations` types for Vitest 4.
 *
 * `vitest-axe` still augments the legacy `Vi` global namespace, which Vitest 4 no
 * longer reads, so the matcher works at runtime but not at the type level. Declaring
 * it against the `vitest` module is what makes `expect(await axe(container))` compile
 * — without it, every accessibility assertion is a type error.
 */
declare module 'vitest' {
  interface Assertion<T = unknown> extends AxeMatchers {
    // `T` is unused here; it is required to match the interface being extended.
    _axeAssertionTarget?: T;
  }
  interface AsymmetricMatchersContaining extends AxeMatchers {
    _axeAsymmetricMarker?: never;
  }
}
