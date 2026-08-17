/**
 * Broadcast row types shared by the aggregate repositories — Milestone 14.
 */

import type { SegmentDefinition } from '../services/segments';

export type SegmentRow = {
  id: string;
  name: string;
  definition: SegmentDefinition;
  createdAt: Date;
};

export type TemplateRow = {
  id: string;
  name: string;
  language: string;
  metaStatus: string;
  rejectionReason: string | null;
  body: unknown;
  createdAt: Date;
};

export type CampaignRow = {
  id: string;
  name: string;
  segmentId: string;
  segmentName: string;
  templateId: string;
  templateName: string;
  status: string;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecipientRow = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  phoneNumber: string;
  status: string;
  failureReason: string | null;
};
