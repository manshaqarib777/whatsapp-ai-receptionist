export type WorkflowRow = {
  id: string;
  name: string;
  isEnabled: boolean;
  currentVersionId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowVersionRow = {
  id: string;
  versionNumber: number;
  definition: unknown;
  triggerKind: string;
  createdAt: Date;
};

export type WorkflowRunRow = {
  id: string;
  workflowVersionId: string;
  triggerEntityType: string | null;
  triggerEntityId: string | null;
  status: string;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  context: unknown;
};

export type WorkflowRunStepRow = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  status: string;
  output: unknown;
  scheduledFor: Date | null;
  createdAt: Date;
};
