import { z } from 'zod';

import { TRIGGER_KINDS } from '@/features/workflow-builder/services/graph';

/**
 * Zod schemas for the workflow API (M13).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details. The graph definition itself is validated by `validateGraph` in the
 * service (a structural problem is a 409, not a 400).
 */

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'condition', 'action', 'delay']),
  actionKind: z.enum(['send_message', 'tag', 'assign', 'create_task']).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.enum(['true', 'false']).optional(),
});

export const workflowVariableSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  variables: z.array(workflowVariableSchema).default([]),
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(100),
});

export const cloneWorkflowSchema = createWorkflowSchema;

export const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
});

export const saveVersionSchema = z.object({
  definition: workflowDefinitionSchema,
  triggerKind: z.enum(TRIGGER_KINDS),
});

export const createRunSchema = z
  .object({
    variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .default({}),
  })
  .strict();
