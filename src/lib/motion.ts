/**
 * Motion primitives — the single source of truth for animation values.
 *
 * Components import these rather than writing inline transitions, so timing stays
 * consistent and a change to the system is one edit (MOTION_RULES.md §2).
 */

/** Matches --ease-standard. Fast out, slow in — the Linear/Vercel feel. */
export const EASE = [0.32, 0.72, 0, 1] as const;

export const DURATION = {
  instant: 0.1,
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: EASE },
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: DURATION.base, ease: EASE },
} as const;

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: DURATION.base, ease: EASE },
} as const;

/**
 * Stagger for lists on FIRST RENDER only. Re-running an entrance animation on every
 * refetch is nauseating, so callers must not key this to data changes.
 */
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.025, delayChildren: 0.02 } },
} as const;

export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.fast, ease: EASE },
} as const;
