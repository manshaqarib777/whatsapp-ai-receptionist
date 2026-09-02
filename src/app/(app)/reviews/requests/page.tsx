import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { ReviewRequestList } from '@/features/reviews/components/review-request-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Review requests' };

export const dynamic = 'force-dynamic';

/**
 * Review requests (Milestone 16).
 */
export default async function ReviewRequestsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review requests"
        description="Requests sent to customers after completed appointments."
      />
      <Suspense fallback={<LoadingState rows={4} label="Loading requests" />}>
        <ReviewRequestList />
      </Suspense>
    </div>
  );
}
