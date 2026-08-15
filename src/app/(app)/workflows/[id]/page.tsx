import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { WorkflowBuilder } from '@/features/workflow-builder/components/workflow-builder';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Workflow builder' };

export const dynamic = 'force-dynamic';

/**
 * Workflow builder (Milestone 13).
 */
export default async function WorkflowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow builder" description="Edit the node graph." />
      <Suspense fallback={<LoadingState rows={6} label="Loading workflow" />}>
        <WorkflowBuilder workflowId={id} />
      </Suspense>
    </div>
  );
}
