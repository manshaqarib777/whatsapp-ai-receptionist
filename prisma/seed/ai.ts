import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, seedId } from './support';
import type { SeededTenants } from './tenants';

/**
 * AI Engine seed (Milestone 8).
 *
 * Deterministic: prompt templates with active versions (system, booking,
 * complaint, escalation) and a couple of `ai_runs` from the demo conversation
 * so the run log renders. The runs reference the seeded inbox conversation.
 */

export type SeededAi = Awaited<ReturnType<typeof seedAi>>;

const TEMPLATES = [
  {
    key: 'receptionist.faq',
    name: 'Receptionist — FAQ answers',
    body: [
      'You are the WhatsApp receptionist for {{business_name}}.',
      'Answer the customer briefly and conversationally.',
      'Never invent facts. Never make pricing commitments. Never mention internal ids.',
      'Use the retrieved context when provided.',
      '',
      '{{conversation_context}}',
    ].join('\n'),
  },
  {
    key: 'receptionist.booking',
    name: 'Receptionist — bookings',
    body: [
      'You are the WhatsApp receptionist for {{business_name}}.',
      'Help the customer find a time and propose a booking.',
      'Never confirm a booking until the customer agrees to a specific slot.',
      '',
      '{{conversation_context}}',
    ].join('\n'),
  },
  {
    key: 'receptionist.complaint',
    name: 'Receptionist — complaints',
    body: [
      'You are the WhatsApp receptionist for {{business_name}}.',
      'Acknowledge the complaint, stay calm and empathetic, and offer to escalate to a manager.',
      'Never admit legal liability. Never discuss other customers.',
      '',
      '{{conversation_context}}',
    ].join('\n'),
  },
  {
    key: 'receptionist.escalation',
    name: 'Receptionist — human handover',
    body: [
      'You are the WhatsApp receptionist for {{business_name}}.',
      'The customer asked to speak to a person. Confirm a human will take over and stop answering.',
      '',
      '{{conversation_context}}',
    ].join('\n'),
  },
] as const;

export async function seedAi(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<{ templateIds: string[]; runIds: string[]; agentIds: string[] }> {
  const templateIds: string[] = [];
  const runIds: string[] = [];
  const agentIds: string[] = [];

  for (const [index, template] of TEMPLATES.entries()) {
    const row = await prisma.promptTemplate.create({
      data: {
        id: seedId('ai-template', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        key: template.key,
        name: template.name,
        version: 1,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    templateIds.push(row.id);

    const version = await prisma.promptTemplateVersion.create({
      data: {
        id: seedId('ai-template-version', index + 1),
        organizationId: tenants.northwind.id,
        templateId: row.id,
        versionNumber: 1,
        body: template.body,
        status: 'active',
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });

    await prisma.promptTemplate.update({
      where: { id: row.id },
      data: { currentVersionId: version.id },
    });
  }

  const agents = [
    [
      'reception',
      'Reception Agent',
      'Welcomes patients, answers common questions, and coordinates appointments.',
    ],
    [
      'sales',
      'Treatment Sales Agent',
      'Explains approved treatment packages and qualifies quotation requests.',
    ],
    [
      'support',
      'Patient Support Agent',
      'Triages service issues and routes sensitive complaints to a person.',
    ],
    [
      'marketing',
      'Campaign Assistant',
      'Drafts compliant campaign ideas without sending them.',
    ],
    [
      'analytics',
      'Practice Analytics Agent',
      'Explains approved conversion and appointment metrics.',
    ],
    [
      'billing',
      'Billing Agent',
      'Helps with invoices, receipts, VAT, and payment questions.',
    ],
    [
      'manager',
      'Operations Manager Agent',
      'Summarizes operational requests and coordinates escalation.',
    ],
    [
      'knowledge',
      'Knowledge Agent',
      'Finds grounded answers in approved clinic documents.',
    ],
  ] as const;

  for (const [index, [kind, displayName, description]] of agents.entries()) {
    const id = seedId('ai-agent', index + 1);
    await prisma.aiAgent.create({
      data: {
        id,
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        kind,
        displayName,
        description,
        promptTemplateId: kind === 'reception' ? templateIds[0] : null,
        enabled: kind !== 'marketing',
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    agentIds.push(id);
  }

  await prisma.aiAgent.create({
    data: {
      id: seedId('ai-agent-beacon', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      kind: 'reception',
      displayName: 'Service Reception Agent',
      description: 'Synthetic cross-tenant isolation fixture.',
      enabled: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  // A couple of runs from the demo conversation so the run log is not empty.
  const conversation = await prisma.conversation.findFirst({
    where: { organizationId: tenants.northwind.id },
    select: { id: true, branchId: true },
  });

  if (conversation) {
    const runs = [
      {
        id: seedId('ai-run', 1),
        model: 'local/rule',
        intent: 'faq',
        confidence: 0.82,
        inputTokens: 120,
        outputTokens: 40,
        costAmount: 0.00045,
        latencyMs: 340,
        outcome: 'answered' as const,
      },
      {
        id: seedId('ai-run', 2),
        model: 'local/rule',
        intent: 'booking',
        confidence: 0.71,
        inputTokens: 95,
        outputTokens: 35,
        costAmount: 0.00034,
        latencyMs: 290,
        outcome: 'answered' as const,
      },
    ];

    for (const run of runs) {
      await prisma.aiRun.create({
        data: {
          id: run.id,
          organizationId: tenants.northwind.id,
          branchId: conversation.branchId,
          conversationId: conversation.id,
          model: run.model,
          intent: run.intent,
          confidence: run.confidence,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens,
          costAmount: run.costAmount,
          costCurrency: 'USD',
          latencyMs: run.latencyMs,
          outcome: run.outcome,
          agentId: agentIds[0],
          createdAt: SEED_NOW,
        },
      });
      runIds.push(run.id);
    }
  }

  return { templateIds, runIds, agentIds };
}
