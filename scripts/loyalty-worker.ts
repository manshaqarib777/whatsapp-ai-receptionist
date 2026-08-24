import { runLoyaltyWorker } from '@/workflows/loyalty.worker';

/**
 * `npm run loyalty:work` — runs the loyalty earn worker loop.
 */
void runLoyaltyWorker();
