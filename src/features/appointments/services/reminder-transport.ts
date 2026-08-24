export type AppointmentReminderPayload = {
  reminderId: string;
  phoneNumber: string;
  contactName: string;
  startsAt: Date;
  timezone: string;
  serviceName: string;
};

export interface AppointmentReminderTransport {
  send(payload: AppointmentReminderPayload): Promise<void>;
}

/**
 * Meta delivery belongs to Milestone 19. Until it is configured, reminders fail
 * visibly and remain retryable/inspectable; they are never falsely marked sent.
 */
export const unavailableReminderTransport: AppointmentReminderTransport = {
  async send() {
    throw new Error('WhatsApp reminder transport is not configured.');
  },
};
