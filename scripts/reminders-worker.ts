import { runReminderWorker } from '@/workflows/appointment-reminders.worker';

/**
 * `npm run reminders:work` — runs the appointment reminder worker loop.
 */
void runReminderWorker();
