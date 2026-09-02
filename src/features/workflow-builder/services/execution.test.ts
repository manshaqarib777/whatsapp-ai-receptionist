import { describe, expect, it } from 'vitest';

import {
  evaluateCondition,
  traceExecutionSegment,
} from '@/features/workflow-builder/services/execution';
import type { WorkflowDefinition } from '@/features/workflow-builder/services/graph';

const definition: WorkflowDefinition = {
  nodes: [
    { id: 'trigger', type: 'trigger', config: {} },
    {
      id: 'condition',
      type: 'condition',
      config: { variable: 'tier', operator: 'equals', value: 'gold' },
    },
    { id: 'yes', type: 'action', actionKind: 'tag', config: {} },
    { id: 'no', type: 'action', actionKind: 'create_task', config: {} },
  ],
  edges: [
    { id: 'start', from: 'trigger', to: 'condition' },
    { id: 'true', from: 'condition', to: 'yes', label: 'true' },
    { id: 'false', from: 'condition', to: 'no', label: 'false' },
  ],
  variables: [{ name: 'tier', value: 'bronze' }],
};

describe('workflow condition execution', () => {
  it('follows the false branch from default variables', () => {
    expect(
      traceExecutionSegment(definition, 'trigger').nodes.map(({ id }) => id),
    ).toEqual(['trigger', 'condition', 'no']);
  });

  it('uses supplied run variables and follows the true branch', () => {
    expect(
      traceExecutionSegment(definition, 'trigger', { tier: 'gold' }).nodes.map(
        ({ id }) => id,
      ),
    ).toEqual(['trigger', 'condition', 'yes']);
  });

  it('supports bounded comparison operators', () => {
    expect(
      evaluateCondition(
        { variable: 'value', operator: 'greater_than', value: 99 },
        { value: 100 },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { variable: 'name', operator: 'contains', value: 'li' },
        { name: 'Ali' },
      ),
    ).toBe(true);
  });
});
