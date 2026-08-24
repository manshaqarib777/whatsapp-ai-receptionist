import type { ReviewRequestRow } from '../repositories/reviews.types';

export interface ReviewRequestTransport {
  send(input: { organizationId: string; request: ReviewRequestRow }): Promise<void>;
}

export const unavailableReviewRequestTransport: ReviewRequestTransport = {
  async send(): Promise<void> {
    throw new Error('WhatsApp review-request transport is not configured.');
  },
};
