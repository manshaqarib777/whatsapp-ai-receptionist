'use client';

import { useState } from 'react';

import { useRunTurn, useAiRuns } from '@/features/ai/hooks/use-ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * A minimal durable-engine test surface (M8): enqueue a persisted inbound
 * message. Production ingestion uses the same job boundary.
 */

export function RunTurnForm() {
  const [inputMessageId, setInputMessageId] = useState('');
  const runTurn = useRunTurn();
  const { refetch } = useAiRuns();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!inputMessageId.trim()) return;
        runTurn.mutate(
          { inputMessageId: inputMessageId.trim() },
          { onSuccess: () => void refetch() },
        );
      }}
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="run-message">Inbound message id</Label>
          <Input
            id="run-message"
            value={inputMessageId}
            onChange={(event) => setInputMessageId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={runTurn.isPending}>
          {runTurn.isPending ? 'Queuing…' : 'Queue turn'}
        </Button>
        {runTurn.data ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{runTurn.data.job.status}</Badge>
            <span className="text-muted-foreground">Job {runTurn.data.job.id}</span>
          </div>
        ) : null}
        {runTurn.isError ? (
          <span className="text-destructive text-sm">
            {runTurn.error instanceof Error ? runTurn.error.message : 'Run failed.'}
          </span>
        ) : null}
      </div>
    </form>
  );
}
