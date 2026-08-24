import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { SegmentsRepository } from './segments.repository';
import { TemplatesRepository } from './templates.repository';
import { CampaignsRepository } from './campaigns.repository';

/**
 * Broadcast data access facade — Milestone 14.
 *
 * The aggregate repositories (segments, templates, campaigns+recipients) each
 * own one slice of the broadcast database and stay under the 300-line
 * architecture rule. This facade composes them behind the single
 * `BroadcastRepository` surface the service consumes.
 */

export class BroadcastRepository {
  readonly organizationId: string;
  readonly segments: SegmentsRepository;
  readonly templates: TemplatesRepository;
  readonly campaigns: CampaignsRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.segments = new SegmentsRepository(scope);
    this.templates = new TemplatesRepository(scope);
    this.campaigns = new CampaignsRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): BroadcastRepository {
    return new BroadcastRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.segments.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Segments
  // -------------------------------------------------------------------------

  listSegments(): ReturnType<SegmentsRepository['listSegments']> {
    return this.segments.listSegments();
  }

  getSegment(id: string): ReturnType<SegmentsRepository['getSegment']> {
    return this.segments.getSegment(id);
  }

  createSegment(
    input: Parameters<SegmentsRepository['createSegment']>[0],
  ): ReturnType<SegmentsRepository['createSegment']> {
    return this.segments.createSegment(input);
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  listTemplates(): ReturnType<TemplatesRepository['listTemplates']> {
    return this.templates.listTemplates();
  }

  getTemplate(id: string): ReturnType<TemplatesRepository['getTemplate']> {
    return this.templates.getTemplate(id);
  }

  createTemplate(
    input: Parameters<TemplatesRepository['createTemplate']>[0],
  ): ReturnType<TemplatesRepository['createTemplate']> {
    return this.templates.createTemplate(input);
  }

  // -------------------------------------------------------------------------
  // Campaigns
  // -------------------------------------------------------------------------

  listCampaigns(
    filter?: Parameters<CampaignsRepository['listCampaigns']>[0],
  ): ReturnType<CampaignsRepository['listCampaigns']> {
    return this.campaigns.listCampaigns(filter);
  }

  getCampaign(id: string): ReturnType<CampaignsRepository['getCampaign']> {
    return this.campaigns.getCampaign(id);
  }

  createCampaign(
    input: Parameters<CampaignsRepository['createCampaign']>[0],
  ): ReturnType<CampaignsRepository['createCampaign']> {
    return this.campaigns.createCampaign(input);
  }

  updateCampaignStatus(
    id: string,
    status: Parameters<CampaignsRepository['updateCampaignStatus']>[1],
    extras?: Parameters<CampaignsRepository['updateCampaignStatus']>[2],
  ): ReturnType<CampaignsRepository['updateCampaignStatus']> {
    return this.campaigns.updateCampaignStatus(id, status, extras);
  }

  createRecipients(
    campaignId: string,
    contactIds: string[],
  ): ReturnType<CampaignsRepository['createRecipients']> {
    return this.campaigns.createRecipients(campaignId, contactIds);
  }

  listRecipients(campaignId: string): ReturnType<CampaignsRepository['listRecipients']> {
    return this.campaigns.listRecipients(campaignId);
  }

  countRecipientsByStatus(
    campaignId: string,
  ): ReturnType<CampaignsRepository['countRecipientsByStatus']> {
    return this.campaigns.countRecipientsByStatus(campaignId);
  }

  listQueuedDeliveries(
    campaignId: string,
  ): ReturnType<CampaignsRepository['listQueuedDeliveries']> {
    return this.campaigns.listQueuedDeliveries(campaignId);
  }

  markRecipientDelivered(
    recipientId: string,
  ): ReturnType<CampaignsRepository['markRecipientDelivered']> {
    return this.campaigns.markRecipientDelivered(recipientId);
  }

  markRecipientFailed(
    recipientId: string,
    reason: string,
  ): ReturnType<CampaignsRepository['markRecipientFailed']> {
    return this.campaigns.markRecipientFailed(recipientId, reason);
  }

  listDueCampaigns(now: Date): ReturnType<CampaignsRepository['listDueCampaigns']> {
    return this.campaigns.listDueCampaigns(now);
  }

  listSegmentContacts(): ReturnType<CampaignsRepository['listSegmentContacts']> {
    return this.campaigns.listSegmentContacts();
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  CampaignRow,
  RecipientRow,
  SegmentRow,
  TemplateRow,
} from './broadcast.types';
export type { CampaignStatus } from './campaigns.repository';
