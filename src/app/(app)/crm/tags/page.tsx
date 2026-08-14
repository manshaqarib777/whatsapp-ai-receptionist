import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { TagManager } from '@/features/crm/components/tag-manager';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Tags' };

export const dynamic = 'force-dynamic';

/**
 * Tags (Milestone 10) — the tag manager.
 */
export default async function CrmTagsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Tags" description="Labels for deals and contacts." />
      <Suspense fallback={<LoadingState rows={4} label="Loading tags" />}>
        <TagManager />
      </Suspense>
    </div>
  );
}
