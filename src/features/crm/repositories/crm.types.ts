/**
 * CRM row types shared by the aggregate repositories — Milestone 10.
 *
 * Split out of crm.repository.ts so each aggregate repository stays under the
 * 300-line architecture rule while every consumer keeps one import surface.
 */

export type DealStatus = 'open' | 'won' | 'lost';
export type TaggableType = 'contact' | 'deal' | 'conversation';
export type ActivityKind =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'stage_change'
  | 'status_change'
  | 'assigned'
  | 'unassigned'
  | 'label_changed'
  | 'archived';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type PipelineRow = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageRow[];
};

export type PipelineStageRow = {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  winProbability: number;
  dealCount: number;
};

export type DealRow = {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stageName: string;
  title: string;
  valueAmount: number;
  valueCurrency: string;
  status: DealStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  contactName: string | null;
  companyName: string | null;
  tags: { id: string; name: string; color: string }[];
};

export type CompanyRow = {
  id: string;
  name: string;
  vatNumber: string | null;
  createdAt: Date;
  contactCount: number;
  dealCount: number;
};

export type CompanyDetail = CompanyRow & {
  contacts: { id: string; displayName: string; phoneNumber: string }[];
  deals: { id: string; title: string; status: DealStatus; valueAmount: number }[];
};

export type TagRow = {
  id: string;
  name: string;
  color: string;
};

export type ActivityRow = {
  id: string;
  subjectType: TaggableType;
  subjectId: string;
  kind: ActivityKind;
  body: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
};
