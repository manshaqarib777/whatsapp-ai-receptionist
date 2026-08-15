import { TrendChart } from '@/components/charts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Conversations over time — the dashboard's primary chart.
 *
 * A line chart of conversations per day across the global range. The chart wrapper
 * handles the accessibility contract (role="img", trend summary aria-label,
 * visually-hidden data table); this component owns the title, the summary text,
 * and the empty state.
 */

type ConversationsChartProps = {
  data: { date: Date; label: string; conversations: number }[];
  summary: string;
};

const CONFIG: ChartConfig = {
  conversations: { label: 'Conversations', color: 'var(--chart-1)' },
};

export function ConversationsChart({ data, summary }: ConversationsChartProps) {
  const total = data.reduce((sum, point) => sum + point.conversations, 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Conversations over time</CardTitle>
        <CardDescription>
          {total > 0
            ? `${total} conversation${total === 1 ? '' : 's'} in this period`
            : 'No conversations in this period'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            New conversations will appear here as they come in.
          </p>
        ) : (
          <TrendChart
            data={data.map((point) => ({
              label: point.label,
              conversations: point.conversations,
            }))}
            config={CONFIG}
            categoryKey="label"
            series={['conversations']}
            summary={summary}
          />
        )}
      </CardContent>
    </Card>
  );
}
