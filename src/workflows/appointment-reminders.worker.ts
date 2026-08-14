import { logger } from '@/lib/logger';

/**
 * Appointment reminder worker — Milestone 9 (AD-5).
 *
 * A DB-polled worker: marks due `appointment_reminders` as `sent` and delivers
 * through the message transport seam. No Redis — the database is the queue,
 * per ARCHITECTURE_RULES §11 (same pattern as the knowledge ingestion worker).
 *
 * Run with `npm run reminders:work` or the docker-compose `worker` service.
 * Delivery is a no-op stub in M9 (the WhatsApp send path lands with the
 * messaging milestone); the worker marks rows and records the outcome so the
 * status column is real.
 */

const POLL_INTERVAL_MS = 30_000;

export async function processDueReminders(): Promise<number> {
  const { prisma } = await import('@/lib/prisma');
  const due = await prisma.appointmentReminder.findMany({
    where: { status: 'scheduled', sendAt: { lte: new Date() } },
    orderBy: { sendAt: 'asc' },
    take: 50,
    select: { id: true, appointmentId: true },
  });

  for (const reminder of due) {
    try {
      // TODO(M9 messaging milestone): deliver via WhatsApp transport.
      await prisma.appointmentReminder.updateMany({
        where: { id: reminder.id },
        data: { status: 'sent' },
      });
    } catch (error) {
      logger.error(
        { reminderId: reminder.id, err: error },
        'appointment reminder delivery failed',
      );
      await prisma.appointmentReminder.updateMany({
        where: { id: reminder.id },
        data: { status: 'failed' },
      });
    }
  }

  return due.length;
}

export async function runReminderWorker(options: { once?: boolean } = {}): Promise<void> {
  logger.info('appointment reminder worker started');

  for (;;) {
    const sent = await processDueReminders();
    if (sent > 0) {
      logger.info({ sent }, 'appointment reminders processed');
    }

    if (options.once) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
