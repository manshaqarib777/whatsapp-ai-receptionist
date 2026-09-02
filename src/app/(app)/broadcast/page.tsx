import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { CampaignList } from '@/features/broadcast/components/campaign-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Broadcast' };

export const dynamic = 'force-dynamic';

/**
 * Broadcast (Milestone 14) — campaign list.
 */
export default async function BroadcastPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcast"
        description="Send WhatsApp campaigns to segments of your contacts."
      />
      <Suspense fallback={<LoadingState rows={4} label="Loading campaigns" />}>
        <CampaignList />
      </Suspense>
    </div>
  );
}
