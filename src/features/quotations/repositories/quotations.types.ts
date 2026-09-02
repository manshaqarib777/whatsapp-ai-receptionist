/**
 * Quote row types shared by the aggregate repositories — Milestone 11.
 *
 * Split out of quotations.repository.ts so each aggregate repository stays
 * under the 300-line architecture rule while consumers keep one import surface.
 */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type QuoteLineItemRow = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
};

export type QuoteRow = {
  id: string;
  number: string;
  contactId: string;
  contactName: string | null;
  dealId: string | null;
  templateId: string | null;
  status: QuoteStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  validUntil: Date | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineItems: QuoteLineItemRow[];
};

export type QuoteTemplateRow = {
  id: string;
  name: string;
  bodyTemplate: string;
  branding: {
    logoKey?: string | null;
    colors?: Record<string, string> | null;
    footer?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteVersionRow = {
  id: string;
  versionNumber: number;
  snapshot: unknown;
  createdAt: Date;
};
