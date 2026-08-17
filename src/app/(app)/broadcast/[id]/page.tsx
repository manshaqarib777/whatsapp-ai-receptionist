import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { CampaignDetail } from '@/features/broadcast/components/campaign-detail';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Campaign' };

export const dynamic = 'force-dynamic';

/**
 * Broadcast campaign detail (Milestone 14).
 */
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign"
        description="Segment, template, schedule, and analytics."
      />
      <Suspense fallback={<LoadingState rows={6} label="Loading campaign" />}>
        <CampaignDetail campaignId={id} />
      </Suspense>
    </div>
  );
}
