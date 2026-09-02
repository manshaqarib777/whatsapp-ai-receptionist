import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';

import type { RetentionOverview } from '@/features/analytics/services/analytics.service';

/**
 * Retention section (M15) — presentational. Receives the computed retention from
 * the server page; renders the lifecycle distribution and cohort retention.
 */

const STAGE_ORDER = ['lead', 'prospect', 'customer', 'churned'] as const;

export function RetentionSection({ retention }: { retention: RetentionOverview }) {
  const byStage = new Map(
    retention.lifecycle.map((row) => [row.lifecycleStage, row.count]),
  );
  const maxCount = Math.max(1, ...retention.lifecycle.map((row) => row.count));

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Retention</CardTitle>
        <CardDescription>
          Lifecycle distribution, and how many contacts created in the period stayed
          active afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Created in period" value={String(retention.createdInRange)} />
          <Metric
            label="Still active"
            value={String(retention.activeOfCreated)}
            deltaLabel={
              retention.retentionRate === null
                ? 'no contacts in period'
                : `${retention.retentionRate}% retained`
            }
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold">By lifecycle stage</h3>
          {retention.lifecycle.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">No contacts yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {STAGE_ORDER.filter((stage) => byStage.has(stage)).map((stage) => {
                const count = byStage.get(stage) ?? 0;
                return (
                  <li key={stage} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm capitalize">{stage}</span>
                    <div
                      role="img"
                      aria-label={`${stage}: ${count} contacts`}
                      className="bg-primary/10 h-6 rounded-lg"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
