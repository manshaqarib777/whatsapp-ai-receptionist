export type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: {
    id: string;
    pipelineId: string;
    name: string;
    position: number;
    winProbability: number;
    dealCount: number;
  }[];
};

export type Deal = {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stageName: string;
  title: string;
  valueAmount: number;
  valueCurrency: string;
  status: 'open' | 'won' | 'lost';
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  contactName: string | null;
  companyName: string | null;
  tags: { id: string; name: string; color: string }[];
};

export type Activity = {
  id: string;
  subjectType: 'contact' | 'deal' | 'conversation' | 'company';
  subjectId: string;
  kind: string;
  body: string | null;
  actorName: string | null;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  vatNumber: string | null;
  createdAt: string;
  contactCount: number;
  dealCount: number;
};

export type Tag = { id: string; name: string; color: string };

export type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
};
