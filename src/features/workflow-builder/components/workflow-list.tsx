'use client';

import { useState } from 'react';
import Link from 'next/link';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useWorkflow,
  useWorkflows,
} from '@/features/workflow-builder/hooks/use-workflows';

/**
 * Workflow list (M13) — names, enabled state, version count, a create
 * doorway, and an enable/disable toggle per workflow.
 */

export function WorkflowList() {
  const { data, isPending, isError, refetch } = useWorkflows();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading workflows" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const workflows = data?.workflows ?? [];

  if (workflows.length === 0) {
    return (
      <div className="space-y-6">
        <Button onClick={() => setCreateOpen(true)}>New workflow</Button>
        <EmptyState
          title="No workflows yet"
          description="Create a workflow to automate your first trigger."
        />
        <CreateWorkflowDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setCreateOpen(true)}>New workflow</Button>

      <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
        {workflows.map((workflow) => (
          <WorkflowRowItem key={workflow.id} workflowId={workflow.id} />
        ))}
      </ul>

      <CreateWorkflowDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function WorkflowRowItem({ workflowId }: { workflowId: string }) {
  const { data } = useWorkflow(workflowId);
  const update = useUpdateWorkflow();
  const workflow = data?.workflow;

  if (!workflow) return null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/workflows/${workflow.id}`}
          className="hover:text-foreground text-sm font-medium hover:underline"
        >
          {workflow.name}
        </Link>
        <p className="text-muted-foreground text-xs">
          {workflow.isEnabled ? 'Enabled' : 'Disabled'} ·{' '}
          {workflow.currentVersionId ? 'has a version' : 'no version yet'}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending}
        onClick={() => update.mutate({ id: workflow.id, isEnabled: !workflow.isEnabled })}
      >
        {workflow.isEnabled ? 'Disable' : 'Enable'}
      </Button>
    </li>
  );
}

function CreateWorkflowDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateWorkflow();
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setName('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>
            A workflow starts with a trigger and runs actions when it fires.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="workflow-name">Name</Label>
          <Input
            id="workflow-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Welcome message"
          />
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the workflow.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
