// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { embedLocal } from '@/lib/ai-gateway';

/**
 * Local hash embedder (AD-2).
 *
 * Tests the seed/CI-safe fallback: deterministic, right shape (1536-dim), and
 * same-input-same-vector so the integration tests and seed are reproducible.
 */

const DIMENSIONS = 1536;

describe('embedLocal', () => {
  it('returns a 1536-dim vector', () => {
    const vector = embedLocal('hello world');
    expect(vector).toHaveLength(DIMENSIONS);
  });

  it('is deterministic', () => {
    expect(embedLocal('the same text')).toEqual(embedLocal('the same text'));
  });

  it('produces a different vector for different text', () => {
    expect(embedLocal('refund policy')).not.toEqual(embedLocal('opening hours'));
  });

  it('produces a zero vector for empty input (no crash)', () => {
    expect(embedLocal('')).toHaveLength(DIMENSIONS);
  });

  it('produces numbers, not NaN', () => {
    for (const value of embedLocal('anything')) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
