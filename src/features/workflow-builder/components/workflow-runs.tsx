'use client';

import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';

import { useWorkflow } from '@/features/workflow-builder/hooks/use-workflows';

/**
 * Workflow run history (M13) — the manual test runs against a workflow,
 * newest first, with status and error.
 */

export function WorkflowRuns({ workflowId }: { workflowId: string }) {
  const { data } = useWorkflow(workflowId);
  const runs = data?.runs ?? [];

  if (runs.length === 0) {
    return (
      <section className="bg-card text-card-foreground rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Run history</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          No runs yet — use Test run to exercise the workflow against its current version.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Run history</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {runs.map((run) => (
          <li
            key={run.id}
            className="text-muted-foreground flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              {format(new Date(run.startedAt), 'd MMM yyyy, HH:mm')} ·{' '}
              {run.triggerEntityType ?? 'manual'}
            </span>
            <span className="flex items-center gap-2">
              <Badge variant={run.status === 'succeeded' ? 'secondary' : 'outline'}>
                {run.status}
              </Badge>
              {run.error ? (
                <span className="text-destructive text-xs">{run.error}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
