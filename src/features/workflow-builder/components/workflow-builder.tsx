'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  useCreateRun,
  useSaveVersion,
  useWorkflow,
} from '@/features/workflow-builder/hooks/use-workflows';
import {
  validateGraph,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowTriggerKind,
} from '@/features/workflow-builder/services/graph';

import { WorkflowRuns } from './workflow-runs';

/**
 * Workflow builder (M13) — the visual graph editor.
 *
 * The canvas renders ordered node cards (trigger → conditions → actions →
 * delays) with add/remove controls. Node placement is list-ordered with
 * explicit connectors rather than drag-drop: keyboard-reachable, axe-clean,
 * and consistent with the CRM board's button-not-drag precedent.
 *
 * The client mirrors `validateGraph` (the same pure module the server uses)
 * for live feedback; the server remains the authority.
 */

export function WorkflowBuilder({ workflowId }: { workflowId: string }) {
  const { data, isPending, isError, refetch } = useWorkflow(workflowId);

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading workflow" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const { workflow, versions } = data ?? { workflow: undefined, versions: [] };
  if (!workflow) {
    return (
      <EmptyState title="Workflow not found" description="It may have been removed." />
    );
  }

  const current = versions[0];
  const initial: WorkflowDefinition = (current?.definition as WorkflowDefinition) ?? {
    nodes: [],
    edges: [],
    variables: [],
  };

  return (
    <div className="space-y-6">
      <WorkflowEditor
        workflowId={workflow.id}
        workflowName={workflow.name}
        isEnabled={workflow.isEnabled}
        initialDefinition={initial}
        triggerKind={(current?.triggerKind as WorkflowTriggerKind) ?? 'manual'}
        versionNumber={current?.versionNumber ?? 0}
      />
      <WorkflowRuns workflowId={workflow.id} />
    </div>
  );
}

function WorkflowEditor({
  workflowId,
  workflowName,
  isEnabled,
  initialDefinition,
  triggerKind,
  versionNumber,
}: {
  workflowId: string;
  workflowName: string;
  isEnabled: boolean;
  initialDefinition: WorkflowDefinition;
  triggerKind: WorkflowTriggerKind;
  versionNumber: number;
}) {
  const save = useSaveVersion();
  const run = useCreateRun();

  const [definition, setDefinition] = useState<WorkflowDefinition>(initialDefinition);
  const [saved, setSaved] = useState(false);

  const problems = validateGraph(definition).ok
    ? []
    : (
        validateGraph(definition) as {
          ok: false;
          problems: { path: string; message: string }[];
        }
      ).problems;

  const addNode = (type: WorkflowNode['type']) => {
    setDefinition((previous) => ({
      ...previous,
      nodes: [...previous.nodes, { id: `${type}-${Date.now()}`, type, config: {} }],
    }));
    setSaved(false);
  };

  const removeNode = (id: string) => {
    setDefinition((previous) => ({
      nodes: previous.nodes.filter((node) => node.id !== id),
      edges: previous.edges.filter((edge) => edge.from !== id && edge.to !== id),
      variables: previous.variables,
    }));
    setSaved(false);
  };

  const saveVersion = () => {
    const result = validateGraph(definition);
    if (!result.ok) return;
    save.mutate(
      { workflowId, definition: result.definition, triggerKind },
      { onSuccess: () => setSaved(true) },
    );
  };

  const hasTrigger = definition.nodes.some((node) => node.type === 'trigger');

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{workflowName}</h2>
          <p className="text-muted-foreground text-xs">
            Version {versionNumber} · {isEnabled ? 'enabled' : 'disabled'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved ? <Badge variant="secondary">Saved</Badge> : null}
          <Button
            variant="outline"
            size="sm"
            disabled={run.isPending}
            onClick={() => run.mutate(workflowId)}
          >
            {run.isPending ? 'Running…' : 'Test run'}
          </Button>
          <Button
            size="sm"
            disabled={!hasTrigger || problems.length > 0 || save.isPending}
            onClick={saveVersion}
          >
            {save.isPending ? 'Saving…' : 'Save version'}
          </Button>
        </div>
      </div>

      {problems.length > 0 ? (
        <ul className="text-destructive mt-3 space-y-1 text-sm">
          {problems.map((problem) => (
            <li key={problem.path}>
              {problem.path}: {problem.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addNode('trigger')}>
          + Trigger
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('condition')}>
          + Condition
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('action')}>
          + Action
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('delay')}>
          + Delay
        </Button>
      </div>

      <ol className="mt-4 space-y-3">
        {definition.nodes.map((node, index) => (
          <NodeCard
            key={node.id}
            node={node}
            index={index}
            onRemove={() => removeNode(node.id)}
            onChange={(next) => {
              setDefinition((previous) => ({
                ...previous,
                nodes: previous.nodes.map((n) => (n.id === node.id ? next : n)),
              }));
              setSaved(false);
            }}
          />
        ))}
      </ol>

      {!hasTrigger ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Add a trigger node to define what starts this workflow.
        </p>
      ) : null}
    </section>
  );
}

function NodeCard({
  node,
  index,
  onRemove,
  onChange,
}: {
  node: WorkflowNode;
  index: number;
  onRemove: () => void;
  onChange: (next: WorkflowNode) => void;
}) {
  return (
    <li className="border-input flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{index + 1}.</span>
          <Badge variant="outline">{node.type}</Badge>
          {node.actionKind ? <Badge variant="secondary">{node.actionKind}</Badge> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${node.type} node`}
        >
          Remove
        </Button>
      </div>

      {node.type === 'action' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${node.id}-kind`}>Action</Label>
          <select
            id={`${node.id}-kind`}
            className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
            value={node.actionKind ?? 'send_message'}
            onChange={(event) =>
              onChange({
                ...node,
                actionKind: event.target.value as WorkflowNode['actionKind'],
              })
            }
          >
            <option value="send_message">Send message</option>
            <option value="tag">Add tag</option>
            <option value="assign">Assign</option>
            <option value="create_task">Create task</option>
          </select>
          {node.actionKind === 'send_message' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${node.id}-text`}>Message text</Label>
              <Input
                id={`${node.id}-text`}
                defaultValue={(node.config['text'] as string) ?? ''}
                onBlur={(event) =>
                  onChange({
                    ...node,
                    config: { ...node.config, text: event.target.value },
                  })
                }
              />
            </div>
          ) : null}
          {node.actionKind === 'tag' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${node.id}-tag`}>Tag name</Label>
              <Input
                id={`${node.id}-tag`}
                defaultValue={(node.config['tagName'] as string) ?? ''}
                onBlur={(event) =>
                  onChange({
                    ...node,
                    config: { ...node.config, tagName: event.target.value },
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {node.type === 'delay' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${node.id}-delay`}>Delay (seconds)</Label>
          <Input
            id={`${node.id}-delay`}
            type="number"
            min={1}
            defaultValue={(node.config['delaySeconds'] as number) ?? 3600}
            onBlur={(event) =>
              onChange({
                ...node,
                config: { ...node.config, delaySeconds: Number(event.target.value) },
              })
            }
          />
        </div>
      ) : null}

      {node.type === 'condition' ? (
        <p className="text-muted-foreground text-xs">
          A condition branches on its true/false edges. The builder follows the true path
          in test runs.
        </p>
      ) : null}
    </li>
  );
}
