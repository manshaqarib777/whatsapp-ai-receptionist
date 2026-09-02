import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { ReviewPlatformList } from '@/features/reviews/components/review-platform-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Review platforms' };

export const dynamic = 'force-dynamic';

/**
 * Review platforms (Milestone 16) — Google/Facebook connection state.
 */
export default async function ReviewPlatformsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review platforms"
        description="Where customers leave reviews — Google and Facebook."
      />
      <Suspense fallback={<LoadingState rows={2} label="Loading platforms" />}>
        <ReviewPlatformList />
      </Suspense>
    </div>
  );
}
