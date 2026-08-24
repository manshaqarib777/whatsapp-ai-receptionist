import { logger } from '@/lib/logger';
import { listDueAppointmentReminders } from '@/lib/db/system-discovery.repository';
import { AppointmentsRepository } from '@/features/appointments/repositories/appointments.repository';
import {
  unavailableReminderTransport,
  type AppointmentReminderTransport,
} from '@/features/appointments/services/reminder-transport';

/**
 * Appointment reminder worker — Milestone 9 (AD-5).
 *
 * A DB-polled worker: marks due `appointment_reminders` as `sent` and delivers
 * through the message transport seam. No Redis — the database is the queue,
 * per ARCHITECTURE_RULES §11 (same pattern as the knowledge ingestion worker).
 *
 * Run with `npm run reminders:work` or the docker-compose `worker` service.
 * Meta delivery is configured in the integrations milestone. The default
 * transport fails closed: a reminder is never marked sent without a successful
 * transport acknowledgement.
 */

const POLL_INTERVAL_MS = 30_000;

export async function processDueReminders(
  transport: AppointmentReminderTransport = unavailableReminderTransport,
): Promise<number> {
  const due = await listDueAppointmentReminders(new Date());

  for (const reminder of due) {
    const scope = { organizationId: reminder.organizationId, branchId: null };
    const repo = new AppointmentsRepository(scope);
    try {
      const payload = await repo.getReminderDelivery(reminder.id);
      await transport.send(payload);
      await repo.setReminderStatus(reminder.id, 'sent');
    } catch (error) {
      logger.error(
        { reminderId: reminder.id, err: error },
        'appointment reminder delivery failed',
      );
      await repo.setReminderStatus(reminder.id, 'failed');
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
