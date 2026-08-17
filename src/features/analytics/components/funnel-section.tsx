import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { formatCurrency } from '@/features/analytics/services/analytics.service';
import type { FunnelSection as FunnelSectionType } from '@/features/analytics/services/analytics.service';

/**
 * Funnel section (M15) — presentational. Receives the computed funnels from the
 * server page; renders the pipeline funnel and the quote→invoice→paid funnel.
 */

export function FunnelSection({ funnels }: { funnels: FunnelSectionType }) {
  const maxDeals = Math.max(1, ...funnels.pipeline.map((stage) => stage.openDeals));

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Funnels</CardTitle>
        <CardDescription>
          Open deals per pipeline stage, and how accepted quotes become paid invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold">Pipeline</h3>
          {funnels.pipeline.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">No pipeline stages yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {funnels.pipeline.map((stage) => (
                <li key={stage.stageName} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm">
                    {stage.stageName}
                  </span>
                  <div
                    role="img"
                    aria-label={`${stage.stageName}: ${stage.openDeals} open deals`}
                    className="bg-primary/10 h-8 rounded-lg"
                    style={{ width: `${(stage.openDeals / maxDeals) * 100}%` }}
                  />
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {stage.openDeals} · {formatCurrency(stage.openValue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Quote → invoice → paid</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <FunnelStep
              label="Quotes sent"
              value={funnels.conversion.quotes}
              rate={null}
            />
            <FunnelStep
              label="Accepted"
              value={funnels.conversion.accepted}
              rate={funnels.conversion.acceptanceRate}
            />
            <FunnelStep
              label="Invoiced"
              value={funnels.conversion.invoiced}
              rate={funnels.conversion.invoiceRate}
            />
            <FunnelStep
              label="Paid"
              value={funnels.conversion.paid}
              rate={funnels.conversion.paymentRate}
            />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  value,
  rate,
}: {
  label: string;
  value: number;
  rate: number | null;
}) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {rate !== null ? (
          <Badge variant="secondary" className="text-xs">
            {rate}%
          </Badge>
        ) : null}
      </dd>
    </div>
  );
}
