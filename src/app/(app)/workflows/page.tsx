import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { WorkflowList } from '@/features/workflow-builder/components/workflow-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Workflows' };

export const dynamic = 'force-dynamic';

/**
 * Workflows (Milestone 13).
 */
export default async function WorkflowsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Automate triggers, conditions, and actions."
      />
      <Suspense fallback={<LoadingState rows={4} label="Loading workflows" />}>
        <WorkflowList />
      </Suspense>
    </div>
  );
}
