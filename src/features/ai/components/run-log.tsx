'use client';

import { useAiRuns } from '@/features/ai/hooks/use-ai';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';

/**
 * The AI run log — every engine turn recorded in `ai_runs` (M8).
 */

const OUTCOME_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  answered: 'default',
  escalated: 'secondary',
  refused: 'destructive',
  failed: 'destructive',
};

export function RunLog() {
  const { data, isPending, isError, refetch } = useAiRuns();

  if (isPending && !data) {
    return <LoadingState rows={5} label="Loading AI runs" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const runs = data?.runs ?? [];

  if (runs.length === 0) {
    return (
      <EmptyState
        title="No AI runs yet"
        description="When the engine answers a conversation, the turn appears here with its intent, confidence, and outcome."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {runs.map((run) => (
        <li
          key={run.id}
          className="bg-card text-card-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm"
        >
          <Badge variant={OUTCOME_VARIANTS[run.outcome] ?? 'outline'}>
            {run.outcome}
          </Badge>
          <span className="font-medium">{run.intent ?? 'general'}</span>
          <span className="text-muted-foreground tabular-nums">
            {run.confidence === null ? '—' : `${Math.round(run.confidence * 100)}%`}
          </span>
          <span className="text-muted-foreground ms-auto text-xs">
            {run.model} · {run.inputTokens}/{run.outputTokens} tok · {run.latencyMs}ms ·{' '}
            {new Date(run.createdAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
