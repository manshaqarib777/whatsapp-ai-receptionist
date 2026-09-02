import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { CompanyDetail, CompanyRow } from './crm.types';

/**
 * Company data access.
 *
 * Companies are branch-scoped; writes derive a branch scope, never take a
 * branch from a request parameter.
 */
export class CrmCompaniesRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listCompanies(): Promise<CompanyRow[]> {
    const rows = await this.db.company.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        vatNumber: true,
        createdAt: true,
        contacts: { where: { deletedAt: null }, select: { id: true } },
        deals: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber,
      createdAt: row.createdAt,
      contactCount: row.contacts.length,
      dealCount: row.deals.length,
    }));
  }

  async getCompany(id: string): Promise<CompanyDetail> {
    const row = await this.db.company.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        vatNumber: true,
        createdAt: true,
        contacts: {
          where: { deletedAt: null },
          select: { id: true, displayName: true, phoneNumber: true },
        },
        deals: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, valueAmount: true },
        },
      },
    });
    if (!row) throw new NotFoundError('Company not found.');
    return {
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber,
      createdAt: row.createdAt,
      contactCount: row.contacts.length,
      dealCount: row.deals.length,
      contacts: row.contacts,
      deals: row.deals.map((deal) => ({
        ...deal,
        valueAmount: Number(deal.valueAmount),
      })),
    };
  }

  async createCompany(input: {
    branchId: string;
    name: string;
    vatNumber?: string;
  }): Promise<CompanyRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.company.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        vatNumber: input.vatNumber ?? null,
      },
      select: { id: true, name: true, vatNumber: true, createdAt: true },
    });
    return { ...row, contactCount: 0, dealCount: 0 };
  }

  async updateCompany(
    id: string,
    data: { name?: string; vatNumber?: string | null },
  ): Promise<CompanyRow> {
    await expectOne(
      await this.db.company.updateMany({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.vatNumber !== undefined ? { vatNumber: data.vatNumber } : {}),
          version: { increment: 1 },
        },
      }),
      'Company',
    );
    return this.getCompany(id);
  }

  /** Recent companies, for the automation worker to evaluate. */
  async listRecentCompanies(since: Date): Promise<{ id: string; name: string }[]> {
    return this.db.company.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true },
    });
  }
}
