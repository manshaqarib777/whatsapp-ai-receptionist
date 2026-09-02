import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { SegmentManager } from '@/features/broadcast/components/segment-manager';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Broadcast segments' };

export const dynamic = 'force-dynamic';

/**
 * Broadcast segments (Milestone 14) — the filter-tree manager.
 */
export default async function BroadcastSegmentsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segments"
        description="Define the audiences a campaign can target."
      />
      <Suspense fallback={<LoadingState rows={3} label="Loading segments" />}>
        <SegmentManager />
      </Suspense>
    </div>
  );
}
