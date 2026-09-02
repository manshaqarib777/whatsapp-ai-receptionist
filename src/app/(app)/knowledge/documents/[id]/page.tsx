import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { VersionTimeline } from '@/features/knowledge/components/version-timeline';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Document' };

export const dynamic = 'force-dynamic';

/**
 * A knowledge document: its version timeline + approval actions.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document"
        breadcrumbs={[{ label: 'Knowledge', href: '/knowledge' }, { label: 'Document' }]}
      />

      <Suspense fallback={<LoadingState rows={4} label="Loading versions" />}>
        <VersionTimeline documentId={id} />
      </Suspense>
    </div>
  );
}
