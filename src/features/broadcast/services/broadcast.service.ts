import { ConflictError, UnprocessableError } from '@/lib/errors';

import {
  BroadcastRepository,
  type CampaignRow,
  type CampaignStatus,
} from '@/features/broadcast/repositories/broadcast.repository';
import {
  evaluateSegment,
  type SegmentDefinition,
} from '@/features/broadcast/services/segments';

/**
 * Broadcast orchestration — Milestone 14.
 *
 * Pure orchestration over the repository: segment previews (consent-safe
 * evaluation), template approval gating, the campaign lifecycle
 * (draft → scheduled → sending → sent / cancelled), recipient materialisation
 * at send time, and per-campaign analytics derived from recipient rows.
 */

export type CampaignAnalytics = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveredRate: number | null;
};

export class BroadcastService {
  private readonly repo: BroadcastRepository;
  readonly organizationId: string;

  constructor(repo: BroadcastRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): BroadcastService {
    return new BroadcastService(BroadcastRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Segments
  // -------------------------------------------------------------------------

  async listSegments() {
    return this.repo.listSegments();
  }

  async createSegment(input: {
    name: string;
    definition: SegmentDefinition;
  }): Promise<Awaited<ReturnType<typeof this.repo.createSegment>>> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createSegment({ branchId, ...input });
  }

  /** Eligible contact count for a segment — the preview before any send. */
  async previewSegmentCount(segmentId: string): Promise<number> {
    const segment = await this.repo.getSegment(segmentId);
    return (await this.eligibleContactIds(segment.definition)).length;
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async listTemplates() {
    return this.repo.listTemplates();
  }

  async createTemplate(input: {
    name: string;
    language: string;
    body: unknown;
  }): Promise<Awaited<ReturnType<typeof this.repo.createTemplate>>> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createTemplate({ branchId, ...input });
  }

  // -------------------------------------------------------------------------
  // Campaigns
  // -------------------------------------------------------------------------

  async listCampaigns(filter: { status?: CampaignStatus } = {}) {
    return this.repo.listCampaigns(filter);
  }

  async getCampaign(id: string) {
    return this.repo.getCampaign(id);
  }

  async createCampaign(input: {
    name: string;
    segmentId: string;
    templateId: string;
    scheduledFor?: string;
  }): Promise<CampaignRow> {
    const segment = await this.repo.getSegment(input.segmentId);
    const template = await this.repo.getTemplate(input.templateId);

    if (template.metaStatus !== 'approved') {
      throw new ConflictError(
        `The template "${template.name}" is not approved for use yet.`,
      );
    }
    if (!segment.definition || Object.keys(segment.definition).length === 0) {
      throw new UnprocessableError('A segment with no filters cannot target anyone.');
    }

    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createCampaign({
      branchId,
      name: input.name,
      segmentId: input.segmentId,
      templateId: input.templateId,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
    });
  }

  /**
   * Lifecycle transitions. `schedule` sets the send time (or sends now when
   * absent); `cancel` aborts a scheduled campaign; `send` materialises
   * recipients immediately.
   */
  async transition(
    id: string,
    action: 'schedule' | 'send' | 'cancel',
    scheduledFor?: string,
  ): Promise<CampaignRow> {
    const campaign = await this.repo.getCampaign(id);

    switch (action) {
      case 'schedule': {
        if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
          throw new ConflictError(
            'Only a draft or scheduled campaign can be re-scheduled.',
          );
        }
        if (scheduledFor) {
          return this.repo.updateCampaignStatus(id, 'scheduled', {
            scheduledFor: new Date(scheduledFor),
          });
        }
        return this.materialiseAndSend(id);
      }
      case 'send': {
        if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
          throw new ConflictError('Only a draft or scheduled campaign can be sent.');
        }
        return this.materialiseAndSend(id);
      }
      case 'cancel': {
        if (campaign.status === 'sent' || campaign.status === 'cancelled') {
          throw new ConflictError('A sent or cancelled campaign cannot be cancelled.');
        }
        return this.repo.updateCampaignStatus(id, 'cancelled');
      }
      default:
        throw new UnprocessableError('Unknown transition.');
    }
  }

  async getAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    await this.repo.getCampaign(campaignId);
    const counts = await this.repo.countRecipientsByStatus(campaignId);

    const queued = counts['queued'] ?? 0;
    const sent =
      (counts['sent'] ?? 0) + (counts['delivered'] ?? 0) + (counts['read'] ?? 0);
    const delivered = (counts['delivered'] ?? 0) + (counts['read'] ?? 0);
    const read = counts['read'] ?? 0;
    const failed = counts['failed'] ?? 0;

    const denominator = sent + failed;
    return {
      total: queued + sent + failed,
      sent: sent + failed,
      delivered,
      read,
      failed,
      deliveredRate: denominator > 0 ? delivered / denominator : null,
    };
  }

  /** The materialised recipient rows for a campaign (for the detail page). */
  listRecipients(campaignId: string) {
    return this.repo.listRecipients(campaignId);
  }

  // -------------------------------------------------------------------------
  // Worker steps (exported for the DB-polled worker + integration tests)
  // -------------------------------------------------------------------------

  /**
   * Materialises a campaign's recipients from the segment evaluation (consent
   * applied) and advances it to `sending`. A zero-eligible campaign is
   * refused — a broadcast to nobody is a silent no-op.
   */
  async materialiseAndSend(id: string): Promise<CampaignRow> {
    const campaign = await this.repo.getCampaign(id);
    const segment = await this.repo.getSegment(campaign.segmentId);

    const contactIds = await this.eligibleContactIds(segment.definition);
    if (contactIds.length === 0) {
      throw new UnprocessableError('No eligible recipients for this campaign.');
    }

    await this.repo.updateCampaignStatus(id, 'sending', { startedAt: new Date() });
    await this.repo.createRecipients(id, contactIds);

    return this.repo.getCampaign(id);
  }

  /**
   * Worker step: claim due campaigns (scheduled ≤ now, or in-flight sending),
   * mark their queued recipients `sent`, and advance to `sent`.
   */
  async processDueCampaigns(now = new Date()): Promise<number> {
    const due = await this.repo.listDueCampaigns(now);
    let processed = 0;

    for (const campaign of due) {
      await this.repo.markRecipientsSent(campaign.id);
      await this.repo.updateCampaignStatus(campaign.id, 'sent', {
        finishedAt: new Date(),
      });
      processed += 1;
    }

    return processed;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Segment evaluation with the consent/opted-out invariants enforced. */
  private async eligibleContactIds(definition: SegmentDefinition): Promise<string[]> {
    const rows = await this.repo.listSegmentContacts();
    return evaluateSegment(definition, rows);
  }
}
