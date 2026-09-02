/**
 * Workflow graph validation — Milestone 13 (AD-2).
 *
 * The whole graph is JSON on `WorkflowVersion.definition`. `validateGraph` is
 * PURE: given a definition it returns either the typed definition or a list of
 * problems. The server is the authority — an invalid graph is refused before
 * any version row is written — and the client builder mirrors this same module
 * for live feedback only.
 *
 * Shape (see MILESTONE_13_PLAN.md AD-2):
 *
 *   definition: {
 *     nodes: [
 *       { id, type: 'trigger'|'condition'|'action'|'delay',
 *         actionKind?: 'send_message'|'tag'|'assign'|'create_task', config }
 *     ],
 *     edges: [ { id, from, to, label?: 'true'|'false' } ],
 *     variables: [ { name, value } ],
 *   }
 */

export type WorkflowNodeType = 'trigger' | 'condition' | 'action' | 'delay';

export type WorkflowActionKind = 'send_message' | 'tag' | 'assign' | 'create_task';

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  actionKind?: WorkflowActionKind;
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  label?: 'true' | 'false';
};

export type WorkflowVariable = {
  name: string;
  value: string;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
};

export type GraphProblem = {
  path: string;
  message: string;
};

export const TRIGGER_KINDS = ['message_received', 'new_contact', 'manual'] as const;
export type WorkflowTriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * Validates a definition. Returns `{ ok: true, definition }` on success, or
 * `{ ok: false, problems }` listing every issue (not just the first) so the
 * builder can show them all at once.
 */
export function validateGraph(
  input: unknown,
):
  { ok: true; definition: WorkflowDefinition } | { ok: false; problems: GraphProblem[] } {
  const problems: GraphProblem[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      problems: [{ path: 'definition', message: 'Must be an object.' }],
    };
  }

  const nodes = Array.isArray(input['nodes']) ? input['nodes'] : [];
  const edges = Array.isArray(input['edges']) ? input['edges'] : [];
  const variables = Array.isArray(input['variables']) ? input['variables'] : [];

  if (nodes.length === 0) {
    problems.push({ path: 'nodes', message: 'A workflow needs at least one node.' });
  }

  const nodeIds = new Set<string>();
  nodes.forEach((node, index) => {
    if (!isRecord(node)) {
      problems.push({ path: `nodes[${index}]`, message: 'Node must be an object.' });
      return;
    }
    if (typeof node['id'] !== 'string' || node['id'].length === 0) {
      problems.push({ path: `nodes[${index}].id`, message: 'Node id is required.' });
      return;
    }
    if (nodeIds.has(node['id'])) {
      problems.push({
        path: `nodes[${index}].id`,
        message: `Duplicate node id "${node['id']}".`,
      });
    }
    nodeIds.add(node['id']);

    const type = node['type'];
    if (
      type !== 'trigger' &&
      type !== 'condition' &&
      type !== 'action' &&
      type !== 'delay'
    ) {
      problems.push({
        path: `nodes[${index}].type`,
        message: 'Node type must be trigger, condition, action, or delay.',
      });
    }
  });

  const edgesFrom: Record<string, string[]> = {};
  edges.forEach((edge, index) => {
    if (!isRecord(edge)) {
      problems.push({ path: `edges[${index}]`, message: 'Edge must be an object.' });
      return;
    }
    if (typeof edge['id'] !== 'string' || edge['id'].length === 0) {
      problems.push({ path: `edges[${index}].id`, message: 'Edge id is required.' });
      return;
    }
    if (!nodeIds.has(edge['from'] as string)) {
      problems.push({
        path: `edges[${index}].from`,
        message: `Edge from unknown node "${String(edge['from'])}".`,
      });
    }
    if (!nodeIds.has(edge['to'] as string)) {
      problems.push({
        path: `edges[${index}].to`,
        message: `Edge to unknown node "${String(edge['to'])}".`,
      });
    }
    if (typeof edge['from'] === 'string') {
      (edgesFrom[edge['from']] ??= []).push(edge['to'] as string);
    }
  });

  // A condition node must branch: exactly two outgoing edges labelled true/false.
  nodes.forEach((node) => {
    if (isRecord(node) && node['type'] === 'condition') {
      const outgoing = edges.filter((e) => isRecord(e) && e['from'] === node['id']);
      const labels = outgoing.map((e) => (isRecord(e) ? e['label'] : undefined));
      const hasTrue = labels.includes('true');
      const hasFalse = labels.includes('false');
      if (outgoing.length !== 2 || !hasTrue || !hasFalse) {
        problems.push({
          path: `nodes.${String(node['id'])}`,
          message:
            'A condition node needs exactly two outgoing edges labelled true and false.',
        });
      }
    }
    if (isRecord(node) && node['type'] !== 'condition') {
      const outgoing = edges.filter(
        (edge) => isRecord(edge) && edge['from'] === node['id'],
      );
      if (outgoing.length > 1) {
        problems.push({
          path: `nodes.${String(node['id'])}`,
          message: 'A non-condition node may have at most one outgoing edge.',
        });
      }
    }
  });

  const triggerCount = nodes.filter(
    (node) => isRecord(node) && node['type'] === 'trigger',
  ).length;
  if (triggerCount !== 1) {
    problems.push({
      path: 'nodes',
      message: 'A workflow needs exactly one trigger node.',
    });
  }

  // A non-condition node must not carry branch labels.
  edges.forEach((edge, index) => {
    if (
      isRecord(edge) &&
      (edge['label'] === 'true' || edge['label'] === 'false') &&
      nodes.find(
        (n) => isRecord(n) && n['id'] === edge['from'] && n['type'] !== 'condition',
      )
    ) {
      problems.push({
        path: `edges[${index}].label`,
        message: 'Only edges leaving a condition node may carry a branch label.',
      });
    }
  });

  // Variable names must be non-empty and unique.
  const variableNames = new Set<string>();
  variables.forEach((variable, index) => {
    if (!isRecord(variable)) {
      problems.push({
        path: `variables[${index}]`,
        message: 'Variable must be an object.',
      });
      return;
    }
    if (typeof variable['name'] !== 'string' || variable['name'].trim().length === 0) {
      problems.push({
        path: `variables[${index}].name`,
        message: 'Variable name is required.',
      });
      return;
    }
    if (variableNames.has(variable['name'])) {
      problems.push({
        path: `variables[${index}].name`,
        message: `Duplicate variable name "${variable['name']}".`,
      });
    }
    variableNames.add(variable['name']);
  });

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    definition: {
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      variables: variables as WorkflowVariable[],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An empty definition a new workflow can start from. */
export function emptyDefinition(): WorkflowDefinition {
  return { nodes: [], edges: [], variables: [] };
}
