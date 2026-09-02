import { describe, expect, it } from 'vitest';

import {
  emptyDefinition,
  validateGraph,
  type WorkflowDefinition,
} from '@/features/workflow-builder/services/graph';

/**
 * Pure graph-validation unit tests (M13 AD-2).
 *
 * The server is the authority: an invalid graph is refused before any version
 * row is written, so these rules pin exactly what the builder may save.
 */

function validDefinition(): WorkflowDefinition {
  return {
    nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'action-1', type: 'action', actionKind: 'send_message', config: {} },
    ],
    edges: [{ id: 'edge-1', from: 'trigger-1', to: 'action-1' }],
    variables: [],
  };
}

describe('validateGraph', () => {
  it('accepts a valid trigger → action graph', () => {
    const result = validateGraph(validDefinition());
    expect(result.ok).toBe(true);
  });

  it('rejects a non-object definition', () => {
    const result = validateGraph('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems[0]?.path).toBe('definition');
    }
  });

  it('rejects an empty graph', () => {
    const result = validateGraph(emptyDefinition());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.path === 'nodes')).toBe(true);
    }
  });

  it('rejects an edge that references an unknown node', () => {
    const definition = validDefinition();
    definition.edges = [{ id: 'e', from: 'trigger-1', to: 'ghost' }];
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.message.includes('unknown node'))).toBe(true);
    }
  });

  it('rejects duplicate node ids', () => {
    const definition = validDefinition();
    definition.nodes = [
      { id: 'x', type: 'trigger', config: {} },
      { id: 'x', type: 'action', config: {} },
    ];
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.message.includes('Duplicate'))).toBe(true);
    }
  });

  it('rejects a condition node without exactly two labelled branches', () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'trigger', type: 'trigger', config: {} },
        { id: 'cond', type: 'condition', config: {} },
        { id: 'action', type: 'action', actionKind: 'tag', config: {} },
      ],
      edges: [{ id: 'e1', from: 'trigger', to: 'cond' }],
      variables: [],
    };
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.message.includes('true and false'))).toBe(
        true,
      );
    }
  });

  it('accepts a condition node with true and false branches', () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: 'trigger', type: 'trigger', config: {} },
        { id: 'cond', type: 'condition', config: {} },
        { id: 'yes', type: 'action', actionKind: 'tag', config: {} },
        { id: 'no', type: 'action', actionKind: 'create_task', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'trigger', to: 'cond' },
        { id: 'e2', from: 'cond', to: 'yes', label: 'true' },
        { id: 'e3', from: 'cond', to: 'no', label: 'false' },
      ],
      variables: [],
    };
    const result = validateGraph(definition);
    expect(result.ok).toBe(true);
  });

  it('rejects a branch label on an edge leaving a non-condition node', () => {
    const definition = validDefinition();
    definition.edges = [{ id: 'e', from: 'trigger-1', to: 'action-1', label: 'true' }];
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.problems.some((p) => p.message.includes('Only edges leaving a condition')),
      ).toBe(true);
    }
  });

  it('rejects duplicate variable names', () => {
    const definition = validDefinition();
    definition.variables = [
      { name: 'count', value: '1' },
      { name: 'count', value: '2' },
    ];
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.message.includes('Duplicate variable'))).toBe(
        true,
      );
    }
  });

  it('rejects multiple triggers and ambiguous non-condition branches', () => {
    const definition = validDefinition();
    definition.nodes.push(
      { id: 'trigger-2', type: 'trigger', config: {} },
      { id: 'action-2', type: 'action', config: {} },
    );
    definition.edges.push({ id: 'edge-2', from: 'trigger-1', to: 'action-2' });
    const result = validateGraph(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.problems.some((problem) =>
          problem.message.includes('exactly one trigger'),
        ),
      ).toBe(true);
      expect(
        result.problems.some((problem) => problem.message.includes('at most one')),
      ).toBe(true);
    }
  });
});
