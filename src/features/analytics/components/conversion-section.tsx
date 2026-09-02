import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';

import type { ConversionRates } from '@/features/analytics/services/analytics.service';

/**
 * Conversion section (M15) — presentational. Receives the computed rates from
 * the server page; renders the four conversion rates.
 */

export function ConversionSection({ conversion }: { conversion: ConversionRates }) {
  const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Conversion</CardTitle>
        <CardDescription>
          How far opportunities travel, from quote to collected payment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Quote acceptance" value={pct(conversion.quoteAcceptanceRate)} />
          <Metric label="Quote → invoice" value={pct(conversion.quoteToInvoiceRate)} />
          <Metric label="Invoice → paid" value={pct(conversion.invoiceToPaidRate)} />
          <Metric
            label="Deal win rate"
            value={pct(conversion.dealWinRate)}
            deltaLabel={`${conversion.dealWinCount} won · ${conversion.dealLostCount} lost`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
