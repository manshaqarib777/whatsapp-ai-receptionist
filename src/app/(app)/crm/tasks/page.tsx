import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { TaskList } from '@/features/crm/components/task-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Tasks' };

export const dynamic = 'force-dynamic';

/**
 * Tasks (Milestone 10) — the M5 `tasks` table gains its surface.
 */
export default async function CrmTasksPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Follow-ups with assignee and due date." />
      <Suspense fallback={<LoadingState rows={5} label="Loading tasks" />}>
        <TaskList />
      </Suspense>
    </div>
  );
}
