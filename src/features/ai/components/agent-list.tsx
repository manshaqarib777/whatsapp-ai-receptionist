'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  type AiAgent,
  useAiAgents,
  useTestAiAgent,
  useUpdateAiAgent,
} from '../hooks/use-ai';

export function AgentList({ canManage }: { canManage: boolean }) {
  const query = useAiAgents();
  if (query.isPending) return <LoadingState rows={8} label="Loading AI agents" />;
  if (query.isError)
    return (
      <ErrorState
        title="AI agents could not be loaded"
        onRetry={() => void query.refetch()}
      />
    );
  const agents = query.data?.agents ?? [];
  if (!agents.length)
    return (
      <EmptyState
        title="No AI agents"
        description="Seed or configure specialists for this branch."
      />
    );
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Capabilities are fixed by the server. Test runs are local, labelled, and never
        deliver a message.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, canManage }: { agent: AiAgent; canManage: boolean }) {
  const update = useUpdateAiAgent();
  const test = useTestAiAgent();
  const [result, setResult] = useState<string | null>(null);
  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    setResult(null);
    await update.mutateAsync({
      id: agent.id,
      version: agent.version,
      displayName: String(data.get('displayName') ?? ''),
      description: String(data.get('description') ?? ''),
    });
  }
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-labelledby={`agent-${agent.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`agent-${agent.id}`} className="font-semibold">
            {agent.displayName}
          </h2>
          <p className="text-muted-foreground text-sm">{agent.purpose}</p>
        </div>
        <Badge variant={agent.enabled ? 'default' : 'secondary'}>
          {agent.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Allowed capabilities">
        {agent.tools.length ? (
          agent.tools.map((tool) => (
            <Badge key={tool} variant="outline">
              {tool}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">No tools</Badge>
        )}
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        <label className="block space-y-1 text-sm">
          <span>Display name</span>
          <Input
            name="displayName"
            defaultValue={agent.displayName}
            disabled={!canManage || update.isPending}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Description</span>
          <Input
            name="description"
            defaultValue={agent.description}
            disabled={!canManage || update.isPending}
          />
        </label>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={update.isPending}>
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: agent.id,
                  version: agent.version,
                  enabled: !agent.enabled,
                })
              }
            >
              {agent.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        ) : null}
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = String(new FormData(event.currentTarget).get('message') ?? '');
          void test
            .mutateAsync({ id: agent.id, message })
            .then(({ result: next }) =>
              setResult(`${next.routedKind ?? 'human'}: ${next.reply}`),
            );
        }}
      >
        <label className="block space-y-1 text-sm">
          <span>Test routing phrase</span>
          <Input
            name="message"
            placeholder="I need a copy of my invoice"
            disabled={!canManage || test.isPending}
          />
        </label>
        {canManage ? (
          <Button type="submit" variant="secondary" disabled={test.isPending}>
            Run local test
          </Button>
        ) : null}
      </form>
      {update.isError || test.isError ? (
        <p role="alert" className="text-destructive text-sm">
          The request failed. Refresh and try again.
        </p>
      ) : null}
      {result ? (
        <p role="status" className="bg-muted rounded-md p-3 text-sm">
          {result}
        </p>
      ) : null}
    </section>
  );
}
