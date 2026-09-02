import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { DocumentList } from '@/features/knowledge/components/document-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Source' };

export const dynamic = 'force-dynamic';

/**
 * A knowledge source: its documents + the upload form.
 */
export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Source"
        breadcrumbs={[{ label: 'Knowledge', href: '/knowledge' }, { label: 'Source' }]}
      />

      <Suspense fallback={<LoadingState rows={5} label="Loading documents" />}>
        <DocumentList sourceId={id} />
      </Suspense>
    </div>
  );
}
