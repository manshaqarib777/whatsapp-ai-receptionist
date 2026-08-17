import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { BroadcastBaseRepository } from './broadcast.base';
import type { CampaignRow, RecipientRow } from './broadcast.types';

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  segmentId: true,
  templateId: true,
  status: true,
  scheduledFor: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  segment: { select: { name: true } },
  template: { select: { name: true } },
} as const;

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

/**
 * Campaign + recipient data access.
 *
 * Recipients are materialised at send time from the segment evaluation, one
 * row per contact (unique `(campaignId, contactId)`), and link back to the
 * message stream. The schema's unique constraint makes a re-send a no-op, not
 * a duplicate.
 */
export class CampaignsRepository extends BroadcastBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listCampaigns(filter: { status?: CampaignStatus } = {}): Promise<CampaignRow[]> {
    const rows = await this.db.campaign.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: CAMPAIGN_SELECT,
    });
    return rows.map(toCampaignRow);
  }

  async getCampaign(id: string): Promise<CampaignRow> {
    const row = await this.db.campaign.findFirst({
      where: { id, deletedAt: null },
      select: CAMPAIGN_SELECT,
    });
    if (!row) throw new NotFoundError('Campaign not found.');
    return toCampaignRow(row);
  }

  async createCampaign(input: {
    branchId: string;
    name: string;
    segmentId: string;
    templateId: string;
    scheduledFor?: Date;
  }): Promise<CampaignRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.campaign.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        segmentId: input.segmentId,
        templateId: input.templateId,
        status: 'draft',
        scheduledFor: input.scheduledFor ?? null,
      },
      select: { id: true },
    });
    return this.getCampaign(row.id);
  }

  async updateCampaignStatus(
    id: string,
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled',
    extras: { scheduledFor?: Date; startedAt?: Date; finishedAt?: Date } = {},
  ): Promise<CampaignRow> {
    await this.db.campaign.updateMany({
      where: { id },
      data: {
        status,
        ...(extras.scheduledFor !== undefined
          ? { scheduledFor: extras.scheduledFor }
          : {}),
        ...(extras.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
        ...(extras.finishedAt !== undefined ? { finishedAt: extras.finishedAt } : {}),
        version: { increment: 1 },
      },
    });
    return this.getCampaign(id);
  }

  async createRecipients(campaignId: string, contactIds: string[]): Promise<number> {
    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    let created = 0;
    for (const contactId of contactIds) {
      try {
        await db.campaignRecipient.create({
          data: {
            organizationId: this.organizationId,
            campaignId,
            contactId,
            status: 'queued',
          },
        });
        created += 1;
      } catch (error) {
        // Unique (campaignId, contactId) — a re-send must not duplicate.
        const code = (error as { code?: string })?.code;
        if (code !== 'P2002') throw error;
      }
    }
    return created;
  }

  async listRecipients(campaignId: string): Promise<RecipientRow[]> {
    const rows = await this.db.campaignRecipient.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        contactId: true,
        status: true,
        failureReason: true,
        contact: { select: { displayName: true, phoneNumber: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      contactId: row.contactId,
      contactDisplayName: row.contact.displayName,
      phoneNumber: row.contact.phoneNumber,
      status: row.status,
      failureReason: row.failureReason,
    }));
  }

  async countRecipientsByStatus(campaignId: string): Promise<Record<string, number>> {
    const rows = await this.db.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  async markRecipientsSent(campaignId: string): Promise<number> {
    const result = await this.db.campaignRecipient.updateMany({
      where: { campaignId, status: 'queued' },
      data: { status: 'sent', updatedAt: new Date() },
    });
    return result.count;
  }

  /** Due scheduled/sending campaigns, for the worker to claim. */
  async listDueCampaigns(now: Date): Promise<CampaignRow[]> {
    const rows = await this.db.campaign.findMany({
      where: {
        deletedAt: null,
        OR: [{ status: 'sending' }, { status: 'scheduled', scheduledFor: { lte: now } }],
      },
      orderBy: { scheduledFor: 'asc' },
      select: CAMPAIGN_SELECT,
    });
    return rows.map(toCampaignRow);
  }

  /**
   * The contact rows a segment evaluates over, with the open-deal value
   * precomputed. Scoped to the org.
   */
  async listSegmentContacts(): Promise<
    {
      id: string;
      locale: string;
      lifecycleStage: string;
      hasConsent: boolean;
      optedOutAt: Date | null;
      createdAt: Date;
      openDealValue: number;
    }[]
  > {
    const rows = await this.db.contact.findMany({
      where: { deletedAt: null, redactedAt: null },
      select: {
        id: true,
        locale: true,
        lifecycleStage: true,
        hasConsent: true,
        optedOutAt: true,
        createdAt: true,
        deals: {
          where: { status: 'open', deletedAt: null },
          select: { valueAmount: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      locale: row.locale,
      lifecycleStage: row.lifecycleStage,
      hasConsent: row.hasConsent,
      optedOutAt: row.optedOutAt,
      createdAt: row.createdAt,
      openDealValue: row.deals.reduce((sum, deal) => sum + Number(deal.valueAmount), 0),
    }));
  }
}

function toCampaignRow(row: {
  id: string;
  name: string;
  segmentId: string;
  templateId: string;
  status: string;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  segment: { name: string } | null;
  template: { name: string } | null;
}): CampaignRow {
  return {
    id: row.id,
    name: row.name,
    segmentId: row.segmentId,
    segmentName: row.segment?.name ?? '',
    templateId: row.templateId,
    templateName: row.template?.name ?? '',
    status: row.status,
    scheduledFor: row.scheduledFor,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
