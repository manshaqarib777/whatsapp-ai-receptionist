import { runBroadcastWorker } from '@/workflows/broadcast.worker';

/**
 * `npm run broadcast:work` — runs the broadcast send worker loop.
 */
void runBroadcastWorker();
