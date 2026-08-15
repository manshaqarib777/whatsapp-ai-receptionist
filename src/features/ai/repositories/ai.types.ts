/**
 * AI-engine row types shared by the aggregate repositories — Milestone 8.
 *
 * Split out of ai.repository.ts so each aggregate repository stays under the
 * 300-line architecture rule while consumers keep one import surface.
 */

export type AiRunRow = {
  id: string;
  conversationId: string | null;
  model: string;
  intent: string | null;
  confidence: number | null;
  inputTokens: number;
  outputTokens: number;
  costAmount: number;
  costCurrency: string;
  latencyMs: number;
  outcome: string;
  createdAt: Date;
};

export type PromptTemplateRow = {
  id: string;
  key: string;
  name: string;
  currentVersionId: string | null;
  version: number;
  createdAt: Date;
};

export type PromptTemplateDetail = PromptTemplateRow & {
  versions: {
    id: string;
    versionNumber: number;
    body: string;
    status: string;
    createdAt: Date;
  }[];
};

export type NewTemplateInput = {
  key: string;
  name: string;
  body: string;
  branchId?: string;
};
