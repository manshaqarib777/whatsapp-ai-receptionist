import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';

import { formatCurrency } from '@/features/analytics/services/analytics.service';
import type { ForecastOverview } from '@/features/analytics/services/analytics.service';

/**
 * Forecast section (M15) — presentational. Receives the computed forecast from
 * the server page; renders the weighted pipeline value, its per-stage
 * decomposition, and the explicitly-labelled projection.
 */

export function ForecastSection({ forecast }: { forecast: ForecastOverview }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Forecast</CardTitle>
        <CardDescription>
          Weighted pipeline value (open deal × win probability) plus a 3-month
          trailing-average projection of collected revenue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Metric label="Weighted forecast" value={formatCurrency(forecast.weighted)} />
          <Metric
            label="Open pipeline value"
            value={formatCurrency(forecast.openValue)}
          />
          <Metric label="Open deals" value={String(forecast.deals)} />
        </div>

        {forecast.byStage.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">By stage</h3>
            <ul className="mt-2 space-y-1.5">
              {forecast.byStage.map((stage) => (
                <li
                  key={stage.stageName}
                  className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {stage.stageName} · {stage.deals} deals
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(stage.value)} → {formatCurrency(stage.weighted)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No open deals to forecast.</p>
        )}

        {forecast.projection.length > 0 && forecast.projectionIsEstimate ? (
          <div>
            <h3 className="text-sm font-semibold">Projection</h3>
            <p className="text-muted-foreground text-xs">Past trend, not a commitment.</p>
            <ul className="mt-2 space-y-1.5">
              {forecast.projection.map((row) => (
                <li
                  key={row.month}
                  className="text-muted-foreground flex items-center justify-between text-sm"
                >
                  <span>{row.month}</span>
                  <span className="tabular-nums">{formatCurrency(row.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
