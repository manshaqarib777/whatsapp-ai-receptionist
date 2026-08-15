import { Suspense } from 'react';

import { ActivityFeed } from '@/features/dashboard/components/activity-feed';
import { ConversationsChart } from '@/features/dashboard/components/conversations-chart';
import { KpiGrid, KpiGridSkeleton } from '@/features/dashboard/components/kpi-grid';
import { RangePicker } from '@/features/dashboard/components/range-picker';
import { RecentConversations } from '@/features/dashboard/components/recent-conversations';
import { RevenueChart } from '@/features/dashboard/components/revenue-chart';
import { UpcomingAppointments } from '@/features/dashboard/components/upcoming-appointments';
import { greetingForHour } from '@/features/dashboard/lib/greeting';
import { parseDashboardRange, rangeToDates } from '@/features/dashboard/lib/range';
import {
  getActivityFeed,
  getConversationTrend,
  getKpis,
  getRecentConversations,
  getRevenueTrend,
  getUpcomingAppointments,
} from '@/features/dashboard/services/dashboard.service';
import { requireOrg } from '@/server/auth-context';
import { cookies } from 'next/headers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard page.
 *
 * COMPONENT_DESIGN.md §7: loading is per-widget, not per-page, and failure is
 * per-widget too. Each widget is an async server component suspended behind its
 * own boundary with a skeleton fallback, so the slowest query delays only its own
 * widget. The date range is global (read once from the cookie) and passed to the
 * widgets that observe it.
 */

export const metadata = { title: 'Dashboard' };

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, organizationId } = await requireOrg();

  const cookieStore = await cookies();
  const rangeValue = parseDashboardRange(cookieStore.get('dashboard:range')?.value);
  const range = rangeToDates(rangeValue);

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const name = user.name?.split(/\s+/)[0] ?? 'there';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Here is what is happening across your business.
          </p>
        </div>

        <RangePicker value={rangeValue} />
      </div>

      <Suspense fallback={<KpiGridSkeleton />}>
        <KpiSection organizationId={organizationId} range={range} />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Suspense
          fallback={
            <CardSkeleton
              title="Conversations over time"
              description="Loading conversations…"
            />
          }
        >
          <div className="lg:col-span-2">
            <ConversationsSection
              organizationId={organizationId}
              range={range}
              rangeValue={rangeValue}
            />
          </div>
        </Suspense>

        <Suspense
          fallback={<CardSkeleton title="Activity" description="Loading activity…" />}
        >
          <ActivitySection organizationId={organizationId} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense
          fallback={
            <CardSkeleton
              title="Upcoming appointments"
              description="Loading appointments…"
            />
          }
        >
          <AppointmentsSection organizationId={organizationId} />
        </Suspense>

        <Suspense
          fallback={<CardSkeleton title="Revenue" description="Loading revenue…" />}
        >
          <RevenueSection organizationId={organizationId} range={range} />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <CardSkeleton
            title="Recent conversations"
            description="Loading conversations…"
          />
        }
      >
        <RecentConversationsSection organizationId={organizationId} />
      </Suspense>
    </div>
  );
}

async function KpiSection({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const kpis = await getKpis(organizationId, range);
  return <KpiGrid kpis={kpis} />;
}

async function ConversationsSection({
  organizationId,
  range,
  rangeValue,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
  rangeValue: '30d' | '90d';
}) {
  const trend = await getConversationTrend(organizationId, range);
  const total = trend.reduce((sum, point) => sum + point.conversations, 0);
  return (
    <ConversationsChart
      data={trend}
      summary={`Conversations per day across the last ${rangeValue === '90d' ? 90 : 30} days; ${total} in total.`}
    />
  );
}

async function ActivitySection({ organizationId }: { organizationId: string }) {
  const activities = await getActivityFeed(organizationId);
  return <ActivityFeed activities={activities} />;
}

async function AppointmentsSection({ organizationId }: { organizationId: string }) {
  const appointments = await getUpcomingAppointments(organizationId);
  return <UpcomingAppointments appointments={appointments} />;
}

async function RevenueSection({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const trend = await getRevenueTrend(organizationId, range);
  const total = trend.reduce((sum, point) => sum + point.revenue, 0);
  return (
    <RevenueChart
      data={trend}
      summary={`Invoiced revenue per day in the period; ${total} in total.`}
    />
  );
}

async function RecentConversationsSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const conversations = await getRecentConversations(organizationId);
  return <RecentConversations conversations={conversations} />;
}

function CardSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="status"
          aria-busy="true"
          aria-label={description}
          className="space-y-3"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}
