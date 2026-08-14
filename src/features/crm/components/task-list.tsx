'use client';

import { format } from 'date-fns';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateTask,
  useTasks,
  useUpdateTaskStatus,
} from '@/features/crm/hooks/use-crm';

/**
 * Tasks (M10) — the M5 `tasks` table gains its surface. Create + complete.
 */

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function TaskList() {
  const { data, isPending, isError, refetch } = useTasks('all');
  const updateStatus = useUpdateTaskStatus();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={5} label="Loading tasks" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const tasks = data?.tasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description="Create a task to track follow-ups." />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <Badge variant={task.status === 'done' ? 'secondary' : 'outline'}>
                {STATUS_LABELS[task.status] ?? task.status}
              </Badge>
              <span className={task.status === 'done' ? 'text-muted-foreground min-w-0 flex-1 line-through' : 'min-w-0 flex-1 text-sm font-medium'}>
                {task.title}
              </span>
              {task.dueAt ? (
                <span className="text-muted-foreground text-xs">
                  due {format(new Date(task.dueAt), 'd MMM yyyy')}
                </span>
              ) : null}
              {task.assigneeName ? (
                <span className="text-muted-foreground text-xs">{task.assigneeName}</span>
              ) : null}
              {task.status !== 'done' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: task.id, status: 'done' })}
                >
                  Complete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        dueAt: dueAt || undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setDueAt('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Tasks track follow-ups across the practice.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Call back about the crown fitting"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the task.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
