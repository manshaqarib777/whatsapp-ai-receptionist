'use client';

import { Loader2, CheckCircle2, XCircle, CircleDashed } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ErrorState, LoadingState } from '@/components/states';
import { useJob } from '@/features/knowledge/hooks/use-knowledge';

/**
 * Live status of a single ingestion job.
 *
 * Polls `GET /api/knowledge/jobs/[id]` while the job is queued/running (2s,
 * stops when the tab is hidden). `aria-live` announces transitions to screen
 * readers.
 */

export function JobStatus({ jobId }: { jobId: string }) {
  const { data, isPending, isError, refetch } = useJob(jobId);

  if (isPending && !data) {
    return <LoadingState rows={1} label="Loading job status" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const job = data.job;
  const progress = job.progress ?? 0;

  return (
    <div
      aria-live="polite"
      className="border-border flex items-center gap-3 rounded-2xl border px-4 py-3"
    >
      {job.status === 'queued' || job.status === 'running' ? (
        <Loader2
          aria-hidden="true"
          className="text-muted-foreground size-4 animate-spin"
        />
      ) : job.status === 'succeeded' ? (
        <CheckCircle2 aria-hidden="true" className="size-4 text-green-600" />
      ) : job.status === 'failed' ? (
        <XCircle aria-hidden="true" className="text-destructive size-4" />
      ) : (
        <CircleDashed aria-hidden="true" className="text-muted-foreground size-4" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {job.status === 'queued'
              ? 'Queued'
              : job.status === 'running'
                ? 'Indexing…'
                : job.status === 'succeeded'
                  ? 'Indexed'
                  : 'Failed'}
          </p>
          <Badge variant="secondary">{progress}%</Badge>
        </div>
        {job.error ? <p className="text-muted-foreground text-sm">{job.error}</p> : null}
      </div>

      {job.status === 'queued' || job.status === 'running' ? (
        <Progress value={progress} className="w-24" aria-hidden="true" />
      ) : null}
    </div>
  );
}
