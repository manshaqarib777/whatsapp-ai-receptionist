import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { AppointmentsBaseRepository } from './appointments.base';
import type { ServiceRow } from './appointments.types';

/**
 * Service data access.
 *
 * Services define what can be booked: name, duration, and price. They are
 * branch-scoped; reads run through the org scope, writes through a branch.
 */
export class AppointmentsServicesRepository extends AppointmentsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listServices(branchId?: string): Promise<ServiceRow[]> {
    const rows = await this.db.service.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    return rows.map((row) => ({ ...row, priceAmount: Number(row.priceAmount) }));
  }

  async createService(input: {
    branchId: string;
    name: string;
    description?: string;
    durationMinutes: number;
    priceAmount: number;
    priceCurrency?: string;
  }): Promise<ServiceRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.service.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        description: input.description,
        durationMinutes: input.durationMinutes,
        priceAmount: input.priceAmount,
        priceCurrency: input.priceCurrency ?? 'SAR',
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    return { ...row, priceAmount: Number(row.priceAmount) };
  }

  async getService(id: string): Promise<ServiceRow> {
    const row = await this.db.service.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    if (!row) throw new NotFoundError('Service not found.');
    return { ...row, priceAmount: Number(row.priceAmount) };
  }

  async updateService(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      durationMinutes: number;
      priceAmount: number;
      priceCurrency: string;
    }>,
  ): Promise<ServiceRow> {
    const updated = await this.db.service.updateMany({
      where: { id, deletedAt: null },
      data: input,
    });
    if (updated.count === 0) throw new NotFoundError('Service not found.');
    return this.getService(id);
  }
}
