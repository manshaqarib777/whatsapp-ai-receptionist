import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/states';
import { AddSourceDialog } from '@/features/knowledge/components/add-source-dialog';
import { KnowledgeSearch } from '@/features/knowledge/components/knowledge-search';
import { SourceList } from '@/features/knowledge/components/source-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Knowledge base' };

export const dynamic = 'force-dynamic';

/**
 * Knowledge base (Milestone 7).
 *
 * Sources + documents on one tab, search on another. The `AddSourceDialog`
 * (upload/FAQ/website) is the doorway in; every widget is server-scoped and
 * fails independently behind its own Suspense boundary.
 */
export default async function KnowledgePage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge base"
        description="Documents, FAQs, and websites the AI can cite."
        actions={<AddSourceDialog />}
      />

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          <Suspense fallback={<LoadingState rows={6} label="Loading sources" />}>
            <SourceList />
          </Suspense>
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <KnowledgeSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
