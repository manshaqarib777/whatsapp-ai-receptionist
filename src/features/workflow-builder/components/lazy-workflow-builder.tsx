'use client';

import dynamic from 'next/dynamic';

import { LoadingState } from '@/components/states';

// The graph editor is interaction-heavy and only used on one detail route. Keep its
// hooks, validation UI, and node controls out of the initial application shell.
const WorkflowBuilder = dynamic(
  () =>
    import('@/features/workflow-builder/components/workflow-builder').then(
      (module) => module.WorkflowBuilder,
    ),
  { loading: () => <LoadingState rows={6} label="Loading workflow" /> },
);

export function LazyWorkflowBuilder({ workflowId }: { workflowId: string }) {
  return <WorkflowBuilder workflowId={workflowId} />;
}
