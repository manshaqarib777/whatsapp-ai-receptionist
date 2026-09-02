import type { AiAgentKind } from '../repositories/agents.types';
import { AGENT_CATALOG } from './agent-catalog';

export function routeToAgent(
  message: string,
  enabled: ReadonlySet<AiAgentKind>,
): AiAgentKind | null {
  const normalized = message.trim().toLocaleLowerCase('en');
  let best: { kind: AiAgentKind; score: number } | null = null;
  for (const profile of AGENT_CATALOG) {
    if (!enabled.has(profile.kind) || profile.kind === 'reception') continue;
    const score = profile.keywords.reduce(
      (sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { kind: profile.kind, score };
  }
  return best?.kind ?? (enabled.has('reception') ? 'reception' : null);
}
