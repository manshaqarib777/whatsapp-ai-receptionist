import type {
  WorkflowDefinition,
  WorkflowNode,
} from '@/features/workflow-builder/services/graph';

export type WorkflowVariables = Record<string, string | number | boolean | null>;

export function traceExecutionSegment(
  definition: WorkflowDefinition,
  startNodeId: string,
  supplied: WorkflowVariables = {},
): { nodes: WorkflowNode[]; delay: WorkflowNode | null } {
  const variables: WorkflowVariables = Object.fromEntries(
    definition.variables.map(({ name, value }) => [name, value]),
  );
  Object.assign(variables, supplied);
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  const ordered: WorkflowNode[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = startNodeId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = byId.get(currentId);
    if (!node) break;
    ordered.push(node);
    if (node.type === 'delay') return { nodes: ordered, delay: node };

    const outgoing = definition.edges.filter((edge) => edge.from === node.id);
    if (node.type === 'condition') {
      const result = evaluateCondition(node.config, variables);
      currentId = outgoing.find((edge) => edge.label === String(result))?.to;
    } else {
      currentId = outgoing[0]?.to;
    }
  }
  return { nodes: ordered, delay: null };
}

export function evaluateCondition(
  config: Record<string, unknown>,
  variables: WorkflowVariables,
): boolean {
  const variable = typeof config['variable'] === 'string' ? config['variable'] : '';
  const operator = typeof config['operator'] === 'string' ? config['operator'] : 'equals';
  const actual = variables[variable];
  const expected = config['value'];
  switch (operator) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'not_equals':
      return String(actual ?? '') !== String(expected ?? '');
    case 'contains':
      return String(actual ?? '').includes(String(expected ?? ''));
    case 'greater_than':
      return Number(actual) > Number(expected);
    default:
      return String(actual ?? '') === String(expected ?? '');
  }
}
