import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { ReviewList } from '@/features/reviews/components/review-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Reviews' };

export const dynamic = 'force-dynamic';

/**
 * Reviews (Milestone 16) — the review list.
 */
export default async function ReviewsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Customer feedback from Google and Facebook, and the requests that asked for it."
      />
      <Suspense fallback={<LoadingState rows={4} label="Loading reviews" />}>
        <ReviewList />
      </Suspense>
    </div>
  );
}
