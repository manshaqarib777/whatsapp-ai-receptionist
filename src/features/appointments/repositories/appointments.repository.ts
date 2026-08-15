import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { AppointmentsServicesRepository } from './services.repository';
import { AppointmentsResourcesRepository } from './resources.repository';
import { AppointmentsRepository as BookingsRepository } from './bookings.repository';

/**
 * Appointment Engine data access facade — Milestone 9.
 *
 * The aggregate repositories (services, resources+availability, bookings)
 * each own one slice of the appointments database and stay under the 300-line
 * architecture rule. This facade composes them behind the single
 * `AppointmentsRepository` surface the service and availability module
 * consume, so call sites do not change.
 */

export class AppointmentsRepository {
  readonly organizationId: string;
  readonly services: AppointmentsServicesRepository;
  readonly resources: AppointmentsResourcesRepository;
  readonly bookings: BookingsRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.services = new AppointmentsServicesRepository(scope);
    this.resources = new AppointmentsResourcesRepository(scope);
    this.bookings = new BookingsRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): AppointmentsRepository {
    return new AppointmentsRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.services.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Services
  // -------------------------------------------------------------------------

  listServices(
    branchId?: string,
  ): ReturnType<AppointmentsServicesRepository['listServices']> {
    return this.services.listServices(branchId);
  }

  createService(
    input: Parameters<AppointmentsServicesRepository['createService']>[0],
  ): ReturnType<AppointmentsServicesRepository['createService']> {
    return this.services.createService(input);
  }

  getService(id: string): ReturnType<AppointmentsServicesRepository['getService']> {
    return this.services.getService(id);
  }

  // -------------------------------------------------------------------------
  // Resources + availability
  // -------------------------------------------------------------------------

  listResources(
    branchId?: string,
  ): ReturnType<AppointmentsResourcesRepository['listResources']> {
    return this.resources.listResources(branchId);
  }

  createResource(
    input: Parameters<AppointmentsResourcesRepository['createResource']>[0],
  ): ReturnType<AppointmentsResourcesRepository['createResource']> {
    return this.resources.createResource(input);
  }

  addAvailabilityRule(
    input: Parameters<AppointmentsResourcesRepository['addAvailabilityRule']>[0],
  ): ReturnType<AppointmentsResourcesRepository['addAvailabilityRule']> {
    return this.resources.addAvailabilityRule(input);
  }

  listExceptions(
    from: Date,
    to: Date,
  ): ReturnType<AppointmentsResourcesRepository['listExceptions']> {
    return this.resources.listExceptions(from, to);
  }

  // -------------------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------------------

  listAppointmentsInRange(
    branchId: string,
    from: Date,
    to: Date,
  ): ReturnType<BookingsRepository['listAppointmentsInRange']> {
    return this.bookings.listAppointmentsInRange(branchId, from, to);
  }

  book(
    input: Parameters<BookingsRepository['book']>[0],
  ): ReturnType<BookingsRepository['book']> {
    return this.bookings.book(input);
  }

  getAppointment(id: string): ReturnType<BookingsRepository['getAppointment']> {
    return this.bookings.getAppointment(id);
  }

  updateStatus(
    id: string,
    status: Parameters<BookingsRepository['updateStatus']>[1],
  ): ReturnType<BookingsRepository['updateStatus']> {
    return this.bookings.updateStatus(id, status);
  }

  linkReschedule(
    newId: string,
    originalId: string,
  ): ReturnType<BookingsRepository['linkReschedule']> {
    return this.bookings.linkReschedule(newId, originalId);
  }

  cancelReminders(
    appointmentId: string,
  ): ReturnType<BookingsRepository['cancelReminders']> {
    return this.bookings.cancelReminders(appointmentId);
  }

  createReminders(
    appointmentId: string,
    sendAts: Date[],
  ): ReturnType<BookingsRepository['createReminders']> {
    return this.bookings.createReminders(appointmentId, sendAts);
  }
}

// Re-export the shared types so consumers keep one import surface.
export type { AppointmentRow, ResourceRow, ServiceRow } from './appointments.types';
