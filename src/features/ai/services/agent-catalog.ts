import type { AiAgentKind } from '../repositories/agents.types';

export type AgentProfile = {
  kind: AiAgentKind;
  defaultName: string;
  purpose: string;
  tools: readonly string[];
  keywords: readonly string[];
};

export const AGENT_CATALOG: readonly AgentProfile[] = [
  {
    kind: 'reception',
    defaultName: 'Reception Agent',
    purpose: 'Greets customers, answers general questions, and coordinates handover.',
    tools: [
      'knowledge.lookup',
      'availability.slots',
      'appointment.book',
      'escalate.human',
    ],
    keywords: [],
  },
  {
    kind: 'sales',
    defaultName: 'Sales Agent',
    purpose: 'Qualifies interest and explains services and quotations.',
    tools: ['knowledge.lookup', 'escalate.human'],
    keywords: ['price', 'pricing', 'quote', 'buy', 'package', 'sales'],
  },
  {
    kind: 'support',
    defaultName: 'Support Agent',
    purpose: 'Triages service problems and escalates issues safely.',
    tools: ['knowledge.lookup', 'escalate.human'],
    keywords: ['problem', 'broken', 'issue', 'help', 'complaint', 'support'],
  },
  {
    kind: 'marketing',
    defaultName: 'Marketing Agent',
    purpose: 'Drafts bounded campaign ideas without sending messages.',
    tools: ['knowledge.lookup'],
    keywords: ['campaign', 'promotion', 'marketing', 'offer', 'audience'],
  },
  {
    kind: 'analytics',
    defaultName: 'Analytics Agent',
    purpose: 'Explains approved business metrics without exposing raw tenant data.',
    tools: [],
    keywords: ['analytics', 'metric', 'conversion', 'forecast', 'performance'],
  },
  {
    kind: 'billing',
    defaultName: 'Billing Agent',
    purpose: 'Answers invoice and payment questions and escalates disputes.',
    tools: ['knowledge.lookup', 'escalate.human'],
    keywords: ['invoice', 'payment', 'refund', 'receipt', 'billing', 'vat'],
  },
  {
    kind: 'manager',
    defaultName: 'Manager Agent',
    purpose: 'Summarizes operational questions and coordinates human escalation.',
    tools: ['knowledge.lookup', 'escalate.human'],
    keywords: ['manager', 'supervisor', 'escalate', 'operations'],
  },
  {
    kind: 'knowledge',
    defaultName: 'Knowledge Agent',
    purpose: 'Finds grounded answers in approved knowledge sources.',
    tools: ['knowledge.lookup'],
    keywords: ['policy', 'document', 'knowledge', 'what is', 'how do'],
  },
] as const;

const BY_KIND = new Map(AGENT_CATALOG.map((profile) => [profile.kind, profile]));

export function agentProfile(kind: AiAgentKind): AgentProfile {
  const profile = BY_KIND.get(kind);
  if (!profile) throw new Error('AI agent kind is not registered.');
  return profile;
}

export function boundedAgentTools(
  kind: AiAgentKind,
  requested: readonly string[] = [],
): readonly string[] {
  const ceiling = agentProfile(kind).tools;
  return requested.length === 0
    ? ceiling
    : requested.filter((tool) => ceiling.includes(tool));
}
