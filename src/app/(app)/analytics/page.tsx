import { Suspense } from 'react';
import { cookies } from 'next/headers';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';

import { AnalyticsRangePicker } from '@/features/analytics/components/analytics-range-picker';
import { RevenueSection } from '@/features/analytics/components/revenue-section';
import { FunnelSection } from '@/features/analytics/components/funnel-section';
import { ConversionSection } from '@/features/analytics/components/conversion-section';
import { RetentionSection } from '@/features/analytics/components/retention-section';
import { BookingsSection } from '@/features/analytics/components/bookings-section';
import { PerformanceSection } from '@/features/analytics/components/performance-section';
import { ForecastSection } from '@/features/analytics/components/forecast-section';
import { parseAnalyticsRange, rangeToDates } from '@/features/analytics/lib/range';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';
import { requirePermission } from '@/server/auth-context';

export const metadata = { title: 'Analytics' };

export const dynamic = 'force-dynamic';

/**
 * Analytics page (Milestone 15).
 *
 * Read-only, server-rendered surface: the page fetches each section's data
 * through the service and renders the presentational section components behind
 * per-widget Suspense boundaries (COMPONENT_DESIGN §7 — loading is per-widget).
 * The range is global, read once from the cookie.
 */
export default async function AnalyticsPage() {
  const { organizationId } = await requirePermission('analytics:read');

  const cookieStore = await cookies();
  const rangeValue = parseAnalyticsRange(cookieStore.get('analytics:range')?.value);
  const range = rangeToDates(rangeValue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue, funnels, conversion, retention, bookings, performance, and forecast."
        actions={<AnalyticsRangePicker value={rangeValue} />}
      />

      <Suspense
        fallback={<CardSkeleton title="Revenue" description="Loading revenue…" />}
      >
        <RevenueData organizationId={organizationId} range={range} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Funnels" description="Loading funnels…" />}
      >
        <FunnelData organizationId={organizationId} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Conversion" description="Loading conversion…" />}
      >
        <ConversionData organizationId={organizationId} range={range} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Retention" description="Loading retention…" />}
      >
        <RetentionData organizationId={organizationId} range={range} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Bookings" description="Loading bookings…" />}
      >
        <BookingsData organizationId={organizationId} range={range} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Performance" description="Loading performance…" />}
      >
        <PerformanceData organizationId={organizationId} range={range} />
      </Suspense>

      <Suspense
        fallback={<CardSkeleton title="Forecast" description="Loading forecast…" />}
      >
        <ForecastData organizationId={organizationId} />
      </Suspense>
    </div>
  );
}

async function RevenueData({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const service = AnalyticsService.forOrganization(organizationId);
  const revenue = await service.getRevenue(range);
  return <RevenueSection revenue={revenue} />;
}

async function FunnelData({ organizationId }: { organizationId: string }) {
  const service = AnalyticsService.forOrganization(organizationId);
  const funnels = await service.getFunnels();
  return <FunnelSection funnels={funnels} />;
}

async function ConversionData({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const service = AnalyticsService.forOrganization(organizationId);
  const conversion = await service.getConversion(range);
  return <ConversionSection conversion={conversion} />;
}

async function RetentionData({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const service = AnalyticsService.forOrganization(organizationId);
  const retention = await service.getRetention(range);
  return <RetentionSection retention={retention} />;
}

async function BookingsData({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const service = AnalyticsService.forOrganization(organizationId);
  const bookings = await service.getBookings(range);
  return <BookingsSection bookings={bookings} />;
}

async function PerformanceData({
  organizationId,
  range,
}: {
  organizationId: string;
  range: ReturnType<typeof rangeToDates>;
}) {
  const service = AnalyticsService.forOrganization(organizationId);
  const performance = await service.getPerformance(range);
  return <PerformanceSection performance={performance} />;
}

async function ForecastData({ organizationId }: { organizationId: string }) {
  const service = AnalyticsService.forOrganization(organizationId);
  const forecast = await service.getForecast();
  return <ForecastSection forecast={forecast} />;
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
