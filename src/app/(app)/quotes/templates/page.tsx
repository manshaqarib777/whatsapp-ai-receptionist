import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { TemplateManager } from '@/features/quotations/components/template-manager';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Quote templates' };

export const dynamic = 'force-dynamic';

/**
 * Quote templates (Milestone 11).
 */
export default async function QuoteTemplatesPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote templates"
        description="Body and branding for generated quotes."
      />
      <Suspense fallback={<LoadingState rows={3} label="Loading templates" />}>
        <TemplateManager />
      </Suspense>
    </div>
  );
}
