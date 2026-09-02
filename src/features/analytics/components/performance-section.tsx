import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';

import { formatDuration } from '@/features/analytics/services/analytics.service';
import type { PerformanceOverview } from '@/features/analytics/services/analytics.service';

/**
 * Performance section (M15) — presentational. Receives the computed overview
 * from the server page; renders conversation, response, escalation, workload,
 * and campaign delivery.
 */

export function PerformanceSection({
  performance,
}: {
  performance: PerformanceOverview;
}) {
  const pct = (value: number | null) => (value === null ? '—' : `${value}%`);
  const totalCampaigns = performance.campaigns.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>
          Conversation volume, responsiveness, escalations, workload, and campaign
          delivery in the period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Conversations" value={String(performance.conversations)} />
          <Metric
            label="First response"
            value={
              performance.responseTimeSeconds === null
                ? '—'
                : formatDuration(performance.responseTimeSeconds)
            }
          />
          <Metric
            label="Escalation rate"
            value={pct(performance.escalationRate)}
            deltaLabel={`${performance.escalatedCount} escalated`}
          />
          <Metric label="Campaign recipients" value={String(totalCampaigns)} />
        </div>

        {performance.assigned.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">Workload by assignee</h3>
            <ul className="mt-2 space-y-1.5">
              {performance.assigned.map((row) => (
                <li
                  key={row.assigneeName}
                  className="text-muted-foreground flex items-center justify-between text-sm"
                >
                  <span>{row.assigneeName}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {performance.campaigns.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">Campaign delivery</h3>
            <ul className="mt-2 space-y-1.5">
              {performance.campaigns.map((row) => (
                <li
                  key={row.status}
                  className="text-muted-foreground flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{row.status}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
