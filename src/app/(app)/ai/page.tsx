import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/states';
import { RunLog } from '@/features/ai/components/run-log';
import { RunTurnForm } from '@/features/ai/components/run-turn-form';
import { TemplateList } from '@/features/ai/components/template-list';
import { AgentList } from '@/features/ai/components/agent-list';
import { hasPermission } from '@/features/auth/permissions';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'AI Engine' };

export const dynamic = 'force-dynamic';

/**
 * AI Engine (Milestone 8).
 *
 * Run log + prompt templates + a test turn surface. Every widget is
 * server-scoped and fails independently behind its own Suspense boundary.
 */
export default async function AiPage() {
  const context = await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Engine"
        description="Intent detection, memory, prompt templates, and the run log."
      />

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4 space-y-4">
          <RunTurnForm />
          <Suspense fallback={<LoadingState rows={6} label="Loading AI runs" />}>
            <RunLog />
          </Suspense>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Suspense fallback={<LoadingState rows={8} label="Loading AI agents" />}>
            <AgentList canManage={hasPermission(context.role, 'ai:manage')} />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Suspense fallback={<LoadingState rows={6} label="Loading templates" />}>
            <TemplateList />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
