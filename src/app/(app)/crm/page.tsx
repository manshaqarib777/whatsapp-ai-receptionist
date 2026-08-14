import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { PipelineBoard } from '@/features/crm/components/pipeline-board';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'CRM' };

export const dynamic = 'force-dynamic';

/**
 * CRM pipeline board (Milestone 10). Deals move through stages; the deal drawer
 * holds the timeline, close, and activity actions.
 */
export default async function CrmPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Pipelines, deals, companies, and tags."
      />
      <Suspense fallback={<LoadingState rows={6} label="Loading pipeline" />}>
        <PipelineBoard />
      </Suspense>
    </div>
  );
}
