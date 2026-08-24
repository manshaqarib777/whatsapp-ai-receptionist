/**
 * Appointment row types shared by the aggregate repositories — Milestone 9.
 *
 * Split out of appointments.repository.ts so each aggregate repository stays
 * under the 300-line architecture rule while consumers keep one import surface.
 */

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceAmount: number;
  priceCurrency: string;
};

export type ResourceRow = {
  id: string;
  kind: string;
  name: string;
  userId: string | null;
  rules: { weekday: number; startTime: string; endTime: string }[];
};

export type AppointmentRow = {
  id: string;
  contactId: string;
  serviceId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: string;
  notes: string | null;
  rescheduledFromId: string | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
};
