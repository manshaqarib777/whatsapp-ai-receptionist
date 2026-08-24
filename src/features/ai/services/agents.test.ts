import { describe, expect, it } from 'vitest';
import { AGENT_CATALOG, boundedAgentTools } from './agent-catalog';
import { routeToAgent } from './agent-router';
import { updateAgentSchema } from '../validators/ai.validators';

describe('AI specialist catalog and routing', () => {
  it('defines exactly the eight PRD specialist kinds', () => {
    expect(AGENT_CATALOG.map((agent) => agent.kind)).toEqual([
      'reception',
      'sales',
      'support',
      'marketing',
      'analytics',
      'billing',
      'manager',
      'knowledge',
    ]);
  });
  it('routes domain phrases and falls back to reception', () => {
    const enabled = new Set(AGENT_CATALOG.map((agent) => agent.kind));
    expect(routeToAgent('Please send my invoice receipt', enabled)).toBe('billing');
    expect(routeToAgent('What packages can I buy?', enabled)).toBe('sales');
    expect(routeToAgent('Hello there', enabled)).toBe('reception');
  });
  it('never returns disabled specialists and intersects requested tools', () => {
    expect(
      routeToAgent('I have a payment issue', new Set(['reception', 'support'])),
    ).toBe('support');
    expect(
      boundedAgentTools('knowledge', ['knowledge.lookup', 'appointment.book']),
    ).toEqual(['knowledge.lookup']);
  });
  it('requires optimistic version and at least one bounded change', () => {
    expect(updateAgentSchema.safeParse({ enabled: false, version: 1 }).success).toBe(
      true,
    );
    expect(updateAgentSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(
      updateAgentSchema.safeParse({ version: 1, tools: ['appointment.book'] }).success,
    ).toBe(false);
  });
});
