import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WorkflowNode } from '@/features/workflow-builder/services/graph';

export function WorkflowNodeCard({
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

      {node.type === 'action' ? <ActionFields node={node} onChange={onChange} /> : null}
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
        <ConditionFields node={node} onChange={onChange} />
      ) : null}
    </li>
  );
}

function ActionFields({
  node,
  onChange,
}: {
  node: WorkflowNode;
  onChange: (next: WorkflowNode) => void;
}) {
  return (
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
        <ConfigInput node={node} name="text" label="Message text" onChange={onChange} />
      ) : null}
      {node.actionKind === 'tag' ? (
        <ConfigInput node={node} name="tagName" label="Tag name" onChange={onChange} />
      ) : null}
    </div>
  );
}

function ConditionFields({
  node,
  onChange,
}: {
  node: WorkflowNode;
  onChange: (next: WorkflowNode) => void;
}) {
  const update = (name: string, value: string) =>
    onChange({ ...node, config: { ...node.config, [name]: value } });
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <ConfigInput node={node} name="variable" label="Variable" onChange={onChange} />
      <div className="space-y-1.5">
        <Label htmlFor={`${node.id}-operator`}>Operator</Label>
        <select
          id={`${node.id}-operator`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={String(node.config['operator'] ?? 'equals')}
          onChange={(event) => update('operator', event.target.value)}
        >
          <option value="equals">Equals</option>
          <option value="not_equals">Not equal</option>
          <option value="contains">Contains</option>
          <option value="greater_than">Greater than</option>
          <option value="exists">Exists</option>
        </select>
      </div>
      <ConfigInput node={node} name="value" label="Value" onChange={onChange} />
    </div>
  );
}

function ConfigInput({
  node,
  name,
  label,
  onChange,
}: {
  node: WorkflowNode;
  name: string;
  label: string;
  onChange: (next: WorkflowNode) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${node.id}-${name}`}>{label}</Label>
      <Input
        id={`${node.id}-${name}`}
        defaultValue={String(node.config[name] ?? '')}
        onBlur={(event) =>
          onChange({ ...node, config: { ...node.config, [name]: event.target.value } })
        }
      />
    </div>
  );
}
