export const AI_AGENT_KINDS = [
  'reception',
  'sales',
  'support',
  'marketing',
  'analytics',
  'billing',
  'manager',
  'knowledge',
] as const;

export type AiAgentKind = (typeof AI_AGENT_KINDS)[number];
