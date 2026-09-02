import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { DealRow, DealStatus } from './crm.types';

const DEAL_SELECT = {
  id: true,
  contactId: true,
  companyId: true,
  stageId: true,
  stage: { select: { name: true } },
  title: true,
  valueAmount: true,
  valueCurrency: true,
  status: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  contact: { select: { displayName: true } },
  company: { select: { name: true } },
} as const;

/**
 * Deal data access.
 *
 * Deals are branch-scoped; reads run through the org scope, writes through a
 * derived branch scope. Optimistic-locked via `version` — a stale write is a
 * 409, never a silent clobber.
 */
export class CrmDealsRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listDeals(filter: { stageId?: string; status?: DealStatus }): Promise<DealRow[]> {
    const rows = await this.db.deal.findMany({
      where: {
        deletedAt: null,
        ...(filter.stageId ? { stageId: filter.stageId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: DEAL_SELECT,
    });
    const deals = rows.map(toDealRow);
    const tagsByDeal = await this.tagsForDeals(deals.map((d) => d.id));
    for (const deal of deals) {
      deal.tags = tagsByDeal.get(deal.id) ?? [];
    }
    return deals;
  }

  async getDeal(id: string): Promise<DealRow> {
    const row = await this.db.deal.findFirst({
      where: { id, deletedAt: null },
      select: DEAL_SELECT,
    });
    if (!row) throw new NotFoundError('Deal not found.');
    const deal = toDealRow(row);
    deal.tags = await this.tagsForDeal(id);
    return deal;
  }

  async createDeal(input: {
    branchId: string;
    contactId?: string;
    companyId?: string;
    stageId: string;
    title: string;
    valueAmount?: number;
    valueCurrency?: string;
  }): Promise<DealRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.deal.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        stageId: input.stageId,
        title: input.title,
        valueAmount: input.valueAmount ?? 0,
        valueCurrency: input.valueCurrency ?? 'SAR',
        status: 'open',
      },
      select: DEAL_SELECT,
    });
    const deal = toDealRow(row);
    deal.tags = await this.tagsForDeal(row.id);
    return deal;
  }

  async updateDeal(
    id: string,
    data: {
      title?: string;
      valueAmount?: number;
      valueCurrency?: string;
      contactId?: string | null;
      companyId?: string | null;
    },
  ): Promise<DealRow> {
    const current = await this.getDeal(id);
    await expectOne(
      await this.db.deal.updateMany({
        where: { id, version: current.version },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.valueAmount !== undefined ? { valueAmount: data.valueAmount } : {}),
          ...(data.valueCurrency !== undefined
            ? { valueCurrency: data.valueCurrency }
            : {}),
          ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
          ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
          version: { increment: 1 },
        },
      }),
      'Deal',
    );
    return this.getDeal(id);
  }

  async moveDealToStage(id: string, stageId: string): Promise<DealRow> {
    await this.db.deal.updateMany({
      where: { id },
      data: { stageId, version: { increment: 1 } },
    });
    return this.getDeal(id);
  }

  async closeDeal(id: string, status: 'won' | 'lost'): Promise<DealRow> {
    await this.db.deal.updateMany({
      where: { id, status: 'open' },
      data: { status, closedAt: new Date(), version: { increment: 1 } },
    });
    return this.getDeal(id);
  }

  /** Recent open deals, for the automation worker to evaluate. */
  async listRecentDeals(since: Date): Promise<DealRow[]> {
    const rows = await this.db.deal.findMany({
      where: { deletedAt: null, status: 'open', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: DEAL_SELECT,
    });
    const deals = rows.map(toDealRow);
    const tagsByDeal = await this.tagsForDeals(deals.map((d) => d.id));
    for (const deal of deals) {
      deal.tags = tagsByDeal.get(deal.id) ?? [];
    }
    return deals;
  }

  /** Tags for one deal. */
  private async tagsForDeal(dealId: string): Promise<DealRow['tags']> {
    return (await this.tagsForDeals([dealId])).get(dealId) ?? [];
  }

  /** Tags for many deals, keyed by deal id — one query, not one per deal. */
  private async tagsForDeals(dealIds: string[]): Promise<Map<string, DealRow['tags']>> {
    if (dealIds.length === 0) return new Map();
    const rows = await this.db.taggable.findMany({
      where: { taggableType: 'deal', taggableId: { in: dealIds } },
      select: {
        taggableId: true,
        tag: { select: { id: true, name: true, color: true } },
      },
    });
    const byDeal = new Map<string, DealRow['tags']>();
    for (const row of rows) {
      const list = byDeal.get(row.taggableId) ?? [];
      list.push(row.tag);
      byDeal.set(row.taggableId, list);
    }
    return byDeal;
  }
}

function toDealRow(row: {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stage: { name: string };
  title: string;
  valueAmount: unknown;
  valueCurrency: string;
  status: DealStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  contact: { displayName: string } | null;
  company: { name: string } | null;
}): DealRow {
  return {
    id: row.id,
    contactId: row.contactId,
    companyId: row.companyId,
    stageId: row.stageId,
    stageName: row.stage.name,
    title: row.title,
    valueAmount: Number(row.valueAmount),
    valueCurrency: row.valueCurrency,
    status: row.status,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    contactName: row.contact?.displayName ?? null,
    companyName: row.company?.name ?? null,
    tags: [],
  };
}
