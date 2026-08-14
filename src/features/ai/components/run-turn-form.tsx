'use client';

import { useState } from 'react';

import { useRunTurn, useAiRuns } from '@/features/ai/hooks/use-ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * A minimal engine test surface (M8): run a turn against a conversation and see
 * the intent/confidence/outcome. The real entry point is the inbox's AI seam;
 * this page proves the engine end to end.
 */

export function RunTurnForm() {
  const [conversationId, setConversationId] = useState('');
  const [message, setMessage] = useState('');
  const runTurn = useRunTurn();
  const { refetch } = useAiRuns();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!conversationId.trim() || !message.trim()) return;
        runTurn.mutate(
          { conversationId: conversationId.trim(), message },
          { onSuccess: () => void refetch() },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="run-conversation">Conversation id</Label>
          <Input
            id="run-conversation"
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="run-message">Customer message</Label>
          <Input
            id="run-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Do you have any appointments tomorrow?"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={runTurn.isPending}>
          {runTurn.isPending ? 'Running…' : 'Run turn'}
        </Button>
        {runTurn.data ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{runTurn.data.run.intent.label}</Badge>
            <span className="text-muted-foreground">{runTurn.data.run.outcome}</span>
            <span className="text-muted-foreground">reply: {runTurn.data.run.reply}</span>
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
