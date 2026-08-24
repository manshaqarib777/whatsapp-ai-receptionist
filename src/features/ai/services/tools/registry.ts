import { z } from 'zod';

import type { Scope } from '@/lib/db/scope';
import { hybridSearch } from '@/features/knowledge/lib/retrieval';
import { llmProvider } from '@/lib/llm-gateway';
import { embedLocal } from '@/lib/ai-gateway';
import { assertToolAuthorized } from '@/features/ai/services/guardrails';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { localDateInZone } from '@/features/appointments/services/timezone';

/**
 * Tool registry — Milestone 8 (AD-3).
 *
 * Tools are the ONLY way the AI changes state. Every tool has a Zod input
 * schema, server-side authorization independent of the model's claim, tenant
 * scoping from the session (never from tool arguments), and a typed bounded
 * result. Write tools are confirmation-gated in the engine.
 *
 * M8 ships the read tools (knowledge, availability proposal) and the escalation
 * write tool. The booking tool is a proposal stub — the M9 appointment service
 * becomes its backing implementation in the same session.
 */

export type ToolResult = {
  ok: boolean;
  data: unknown;
  /** Present when the tool needs explicit confirmation before committing a write. */
  requiresConfirmation?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodType;
  execute: (input: unknown, scope: Scope) => Promise<ToolResult>;
};

const knowledgeInput = z
  .object({
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

const escalateInput = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

const availabilityInput = z
  .object({
    serviceId: z.string().uuid(),
    resourceId: z.string().uuid().optional(),
    from: z.string().datetime(),
    timezone: z.string().min(1).max(100),
  })
  .strict();

const bookingInput = z
  .object({
    serviceId: z.string().uuid(),
    resourceId: z.string().uuid(),
    startsAt: z.string().datetime(),
    timezone: z.string().min(1).max(100),
    contactId: z.string().uuid().optional(),
    confirmed: z.boolean().default(false),
  })
  .strict();

/**
 * Knowledge lookup — read tool. Hybrid retrieval (similarity + keyword) over
 * approved current-version chunks, org-scoped.
 */
export const knowledgeTool: ToolDefinition = {
  name: 'knowledge.lookup',
  description: 'Search the knowledge base for an answer to a customer question.',
  schema: knowledgeInput,
  async execute(input, scope) {
    const parsed = knowledgeInput.parse(input);
    const embedding = embedLocal(parsed.query);
    const hits = await hybridSearch(scope, parsed.query, embedding, parsed.limit);
    return {
      ok: true,
      data: {
        hits: hits.map((h) => ({
          chunkId: h.chunkId,
          content: h.content,
          similarity: h.similarity,
          source: h.sourceName,
        })),
      },
    };
  },
};

/**
 * Escalation — write tool. Hands the conversation to a human. The engine marks
 * the conversation escalated after this returns ok.
 */
export const escalateTool: ToolDefinition = {
  name: 'escalate.human',
  description:
    'Hand the conversation to a human agent. Use when the customer asks for a person, is distressed, or the confidence is low.',
  schema: escalateInput,
  async execute(input) {
    const parsed = escalateInput.parse(input);
    return { ok: true, data: { escalated: true, reason: parsed.reason } };
  },
};

/**
 * Availability proposal — read tool. M9's appointment service provides the real
 * slots; the engine asks for a date and receives a bounded list. The M9
 * implementation plugs in behind this same name.
 */
export const availabilityTool: ToolDefinition = {
  name: 'availability.slots',
  description:
    'List open appointment slots for a service (and optionally a resource) on a date.',
  schema: availabilityInput,
  async execute(input, scope) {
    const parsed = availabilityInput.parse(input);
    const slots = await AppointmentsService.forOrganization(
      scope.organizationId,
    ).availability({
      serviceId: parsed.serviceId,
      resourceId: parsed.resourceId,
      date: localDateInZone(new Date(parsed.from), parsed.timezone),
      timezone: parsed.timezone,
    });
    return {
      ok: true,
      data: {
        serviceId: parsed.serviceId,
        resourceId: parsed.resourceId ?? null,
        timezone: parsed.timezone,
        slots,
      },
    };
  },
};

/**
 * Booking proposal — WRITE tool, confirmation-gated. Returns a proposal the
 * engine must confirm before M9's service commits it.
 */
export const bookingTool: ToolDefinition = {
  name: 'appointment.book',
  description:
    'Propose booking an appointment slot. Requires explicit confirmation before committing.',
  schema: bookingInput,
  async execute(input, scope) {
    const parsed = bookingInput.parse(input);
    if (!parsed.confirmed || !parsed.contactId) {
      return {
        ok: true,
        requiresConfirmation: true,
        data: {
          proposed: true,
          serviceId: parsed.serviceId,
          resourceId: parsed.resourceId,
          startsAt: parsed.startsAt,
          timezone: parsed.timezone,
          contactId: parsed.contactId ?? null,
        },
      };
    }
    const appointment = await AppointmentsService.forOrganization(
      scope.organizationId,
    ).book({
      contactId: parsed.contactId,
      serviceId: parsed.serviceId,
      resourceId: parsed.resourceId,
      startsAt: parsed.startsAt,
      timezone: parsed.timezone,
    });
    return {
      ok: true,
      data: { booked: true, appointmentId: appointment.id },
    };
  },
};

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  'knowledge.lookup': knowledgeTool,
  'availability.slots': availabilityTool,
  'appointment.book': bookingTool,
  'escalate.human': escalateTool,
};

export async function executeAuthorizedTool(
  toolName: string,
  input: unknown,
  scope: Scope,
  allowedTools: ReadonlySet<string>,
): Promise<ToolResult> {
  assertToolAuthorized(toolName, allowedTools);
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) throw new Error('AI tool is not registered.');
  return tool.execute(input, scope);
}

export function describeTools(tools: ToolDefinition[]): string {
  return tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
}

export { llmProvider };
