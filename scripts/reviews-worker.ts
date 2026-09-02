import { runReviewsWorker } from '@/workflows/reviews.worker';

/**
 * `npm run reviews:work` — runs the review automation worker loop.
 */
void runReviewsWorker();
