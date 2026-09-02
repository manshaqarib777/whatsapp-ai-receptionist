import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { TemplateManager } from '@/features/broadcast/components/template-manager';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Broadcast templates' };

export const dynamic = 'force-dynamic';

/**
 * Broadcast templates (Milestone 14) — the message-template manager.
 */
export default async function BroadcastTemplatesPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Approved WhatsApp message templates for campaigns."
      />
      <Suspense fallback={<LoadingState rows={3} label="Loading templates" />}>
        <TemplateManager />
      </Suspense>
    </div>
  );
}
