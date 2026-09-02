'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  configureIntegration,
  disconnectIntegration,
  testIntegration,
} from '../services/integrations.client';

type Item = {
  provider: string;
  name: string;
  description: string;
  capabilities: readonly string[];
  fields: readonly { key: string; label: string; placeholder: string }[];
  connection: null | {
    status: string;
    enabled: boolean;
    mode: string;
    config: unknown;
    version: number;
    lastTestedAt: Date | null;
    lastError: string | null;
  };
};

export function IntegrationsSettings({
  items,
  canManage,
}: {
  items: Item[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(provider: string, action: () => Promise<unknown>) {
    setBusy(provider);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Sandbox connections are local and never contact a third party. Live mode requires
        server-managed credentials.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <IntegrationCard
            key={item.provider}
            item={item}
            canManage={canManage}
            busy={busy === item.provider}
            run={(action) => run(item.provider, action)}
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({
  item,
  canManage,
  busy,
  run,
}: {
  item: Item;
  canManage: boolean;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const config = isConfig(item.connection?.config) ? item.connection.config : {};
  const [enabled, setEnabled] = useState(item.connection?.enabled ?? true);
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-labelledby={`integration-${item.provider}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`integration-${item.provider}`} className="font-semibold">
            {item.name}
          </h2>
          <p className="text-muted-foreground text-sm">{item.description}</p>
        </div>
        <Badge
          variant={item.connection?.status === 'connected' ? 'default' : 'secondary'}
        >
          {item.connection?.status ?? 'not configured'}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {item.capabilities.map((capability) => (
          <Badge key={capability} variant="outline">
            {capability}
          </Badge>
        ))}
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const nextConfig = Object.fromEntries(
            item.fields.map((field) => [field.key, String(values.get(field.key) ?? '')]),
          );
          run(() =>
            configureIntegration(item.provider, {
              enabled,
              mode: 'sandbox',
              config: nextConfig,
              ...(item.connection ? { version: item.connection.version } : {}),
            }),
          );
        }}
      >
        {item.fields.map((field) => (
          <label key={field.key} className="block space-y-1 text-sm">
            <span>{field.label}</span>
            <Input
              name={field.key}
              defaultValue={config[field.key] ?? ''}
              placeholder={field.placeholder}
              disabled={!canManage || busy}
              required
            />
          </label>
        ))}
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {item.connection ? 'Save' : 'Configure sandbox'}
            </Button>
            {item.connection ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => testIntegration(item.provider))}
                >
                  Test
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEnabled(!enabled);
                  }}
                >
                  {' '}
                  {enabled ? 'Disable' : 'Enable'}{' '}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => run(() => disconnectIntegration(item.provider))}
                >
                  Disconnect
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </form>
      {item.connection?.lastTestedAt ? (
        <p className="text-muted-foreground text-xs">
          Last tested {new Date(item.connection.lastTestedAt).toLocaleString()}
        </p>
      ) : null}
      {item.connection?.lastError ? (
        <p className="text-destructive text-sm">{item.connection.lastError}</p>
      ) : null}
    </section>
  );
}

function isConfig(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
