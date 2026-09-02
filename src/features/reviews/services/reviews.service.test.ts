// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  FEEDBACK_THRESHOLD,
  PLATFORM_ADAPTERS,
  REQUEST_EXPIRY_DAYS,
  REQUEST_GRACE_HOURS,
  UnconfiguredPlatform,
  adapterFor,
} from '@/features/reviews/services/reviews.service';
import { NotFoundError } from '@/lib/errors';

/**
 * Unit tests for the reviews service (M16) — the pure logic: the feedback
 * threshold, the platform seam (unconfigured adapters fail loudly), and the
 * automation constants.
 */

describe('feedback threshold', () => {
  it('treats ratings below the threshold as needing attention', () => {
    expect(FEEDBACK_THRESHOLD).toBe(4);
    expect(1 < FEEDBACK_THRESHOLD).toBe(true);
    expect(3 < FEEDBACK_THRESHOLD).toBe(true);
    expect(4 < FEEDBACK_THRESHOLD).toBe(false);
    expect(5 < FEEDBACK_THRESHOLD).toBe(false);
  });
});

describe('platform seam', () => {
  it('registers google and facebook adapters', () => {
    expect(PLATFORM_ADAPTERS.map((a) => a.provider)).toEqual(['google', 'facebook']);
  });

  it('exposes every adapter as unconfigured in M16', () => {
    for (const adapter of PLATFORM_ADAPTERS) {
      expect(adapter.configured).toBe(false);
    }
  });

  it('resolves an adapter by provider', () => {
    expect(adapterFor('google').provider).toBe('google');
    expect(adapterFor('facebook').provider).toBe('facebook');
  });

  it('throws for an unknown provider', () => {
    expect(() => adapterFor('yelp')).toThrow(NotFoundError);
  });

  it('an unconfigured platform is never silently connected', () => {
    const adapter = new UnconfiguredPlatform('google');
    expect(adapter.configured).toBe(false);
  });

  it('unconfigured adapters fail loudly on fetch and webhook verification', async () => {
    const adapter = new UnconfiguredPlatform('facebook');
    await expect(adapter.fetchReviews()).rejects.toThrow(/not configured/i);
    expect(() => adapter.verifyWebhook()).toThrow(/not configured/i);
  });
});

describe('automation constants', () => {
  it('waits a day before requesting a review', () => {
    expect(REQUEST_GRACE_HOURS).toBe(24);
  });

  it('gives a request two weeks to be answered', () => {
    expect(REQUEST_EXPIRY_DAYS).toBe(14);
  });
});
