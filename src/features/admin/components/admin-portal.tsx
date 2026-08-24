'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updatePlan, updateSubscription } from '../admin.client';

type PortalData = {
  overview: Record<
    'tenants' | 'users' | 'activeSubscriptions' | 'aiRuns' | 'failedJobs' | 'auditEvents',
    number
  >;
  tenants: {
    items: Array<{
      id: string;
      name: string;
      slug: string;
      members: number;
      branches: number;
      subscription: { status: string; plan: { name: string } } | null;
    }>;
  };
  plans: Array<{
    id: string;
    name: string;
    description: string;
    amount: number;
    currency: string;
    interval: string;
    active: boolean;
    version: number;
    subscriptions: number;
  }>;
  billing: {
    items: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
      interval: string;
      periodEndsAt: string;
      cancelAtPeriodEnd: boolean;
      version: number;
      organization: { name: string };
      plan: { name: string };
    }>;
  };
  logs: {
    items: Array<{
      id: string;
      action: string;
      organizationId: string | null;
      entityType: string | null;
      createdAt: string;
    }>;
  };
  usage: Array<{
    organizationId: string;
    organizationName: string;
    runs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    averageLatencyMs: number;
  }>;
  analytics: {
    conversations: number;
    appointments: Array<{ status: string; count: number }>;
    campaigns: Array<{ status: string; count: number }>;
    invoices: Array<{ currency: string; count: number; total: number; paid: number }>;
  };
  monitoring: {
    status: string;
    databaseLatencyMs: number;
    integrationErrors: number;
    queues: Record<string, number>;
    checkedAt: string;
  };
};

const TABS = [
  'Overview',
  'Tenants',
  'Plans',
  'Billing',
  'Logs',
  'AI usage',
  'Analytics',
  'Monitoring',
] as const;

export function AdminPortal({ data }: { data: PortalData }) {
  return (
    <Tabs
      defaultValue="overview"
      className="min-w-0 overflow-hidden"
      style={{ maxWidth: '100%', width: '100%' }}
    >
      <div className="min-w-0 pb-1">
        <TabsList
          className="gap-1"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            height: 'auto',
            width: '100%',
          }}
        >
          {TABS.map((tab) => (
            <TabsTrigger
              className="h-8 w-full min-w-0"
              key={tab}
              value={tab.toLowerCase().replace(' ', '-')}
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent className="max-w-full min-w-0" value="overview">
        <Overview values={data.overview} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="tenants">
        <Tenants items={data.tenants.items} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="plans">
        <Plans items={data.plans} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="billing">
        <Billing items={data.billing.items} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="logs">
        <Logs items={data.logs.items} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="ai-usage">
        <AiUsage items={data.usage} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="analytics">
        <Analytics data={data.analytics} />
      </TabsContent>
      <TabsContent className="max-w-full min-w-0" value="monitoring">
        <Monitoring data={data.monitoring} />
      </TabsContent>
    </Tabs>
  );
}

function Overview({ values }: { values: PortalData['overview'] }) {
  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(values).map(([key, value]) => (
        <section key={key} className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{label(key)}</p>
          <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
        </section>
      ))}
    </div>
  );
}

function Tenants({ items }: { items: PortalData['tenants']['items'] }) {
  return (
    <DataTable
      headers={['Tenant', 'Members', 'Branches', 'Plan', 'Status']}
      rows={items.map((item) => [
        <span key="tenant">
          <strong>{item.name}</strong>
          <span className="text-muted-foreground block text-xs">{item.slug}</span>
        </span>,
        item.members,
        item.branches,
        item.subscription?.plan.name ?? 'None',
        <Badge key="status" variant={item.subscription ? 'default' : 'secondary'}>
          {item.subscription?.status ?? 'unsubscribed'}
        </Badge>,
      ])}
    />
  );
}

function Plans({ items }: { items: PortalData['plans'] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function toggle(item: PortalData['plans'][number]) {
    setBusy(item.id);
    setError(null);
    try {
      await updatePlan(item.id, { active: !item.active, version: item.version });
      router.refresh();
    } catch {
      setError('The plan could not be updated.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-4 pt-4">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <section
            key={item.id}
            className="space-y-3 rounded-lg border p-4"
            aria-labelledby={`plan-${item.id}`}
          >
            <div className="flex justify-between gap-2">
              <h2 id={`plan-${item.id}`} className="font-semibold">
                {item.name}
              </h2>
              <Badge variant={item.active ? 'default' : 'secondary'}>
                {item.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{item.description}</p>
            <p className="text-xl font-semibold">
              {money(item.amount, item.currency)}
              <span className="text-muted-foreground text-sm font-normal">
                /{item.interval}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {item.subscriptions} subscriptions
            </p>
            <Button
              variant="outline"
              disabled={busy === item.id}
              onClick={() => void toggle(item)}
            >
              {item.active ? 'Deactivate' : 'Activate'}
            </Button>
          </section>
        ))}
      </div>
    </div>
  );
}

function Billing({ items }: { items: PortalData['billing']['items'] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <DataTable
      headers={['Tenant', 'Plan', 'Amount', 'Status', 'Period end', 'Action']}
      rows={items.map((item) => [
        item.organization.name,
        item.plan.name,
        `${money(item.amount, item.currency)}/${item.interval}`,
        <Badge key="status">{item.status}</Badge>,
        new Date(item.periodEndsAt).toLocaleDateString(),
        <Button
          key="action"
          size="sm"
          variant="outline"
          disabled={busy === item.id}
          onClick={() => {
            setBusy(item.id);
            void updateSubscription(item.id, {
              cancelAtPeriodEnd: !item.cancelAtPeriodEnd,
              version: item.version,
            })
              .then(() => router.refresh())
              .finally(() => setBusy(null));
          }}
        >
          {item.cancelAtPeriodEnd ? 'Keep renewal' : 'Cancel at period end'}
        </Button>,
      ])}
    />
  );
}

function Logs({ items }: { items: PortalData['logs']['items'] }) {
  return (
    <DataTable
      headers={['Time', 'Action', 'Tenant id', 'Entity']}
      rows={items.map((item) => [
        new Date(item.createdAt).toLocaleString(),
        item.action,
        item.organizationId ?? 'Platform',
        item.entityType ?? '—',
      ])}
    />
  );
}

function AiUsage({ items }: { items: PortalData['usage'] }) {
  return (
    <DataTable
      headers={['Tenant', 'Runs', 'Tokens', 'Cost', 'Avg latency']}
      rows={items.map((item) => [
        item.organizationName,
        item.runs,
        (item.inputTokens + item.outputTokens).toLocaleString(),
        money(item.costUsd, 'USD'),
        `${item.averageLatencyMs} ms`,
      ])}
    />
  );
}

function Analytics({ data }: { data: PortalData['analytics'] }) {
  const metrics = [
    { name: 'Conversations', value: data.conversations },
    ...data.appointments.map((item) => ({
      name: `Appointments · ${item.status}`,
      value: item.count,
    })),
    ...data.campaigns.map((item) => ({
      name: `Campaigns · ${item.status}`,
      value: item.count,
    })),
  ];
  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((item) => (
          <section key={item.name} className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{item.name}</p>
            <p className="text-xl font-semibold">{item.value}</p>
          </section>
        ))}
      </div>
      <DataTable
        headers={['Currency', 'Invoices', 'Total', 'Paid']}
        rows={data.invoices.map((item) => [
          item.currency,
          item.count,
          money(item.total, item.currency),
          money(item.paid, item.currency),
        ])}
      />
    </div>
  );
}

function Monitoring({ data }: { data: PortalData['monitoring'] }) {
  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Platform</p>
        <Badge>{data.status}</Badge>
      </section>
      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Database latency</p>
        <p className="text-xl font-semibold">{data.databaseLatencyMs} ms</p>
      </section>
      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Integration errors</p>
        <p className="text-xl font-semibold">{data.integrationErrors}</p>
      </section>
      {Object.entries(data.queues).map(([name, value]) => (
        <section key={name} className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{label(name)}</p>
          <p className="text-xl font-semibold">{value}</p>
        </section>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto pt-4">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b text-start">
            {headers.map((header) => (
              <th key={header} scope="col" className="p-3 text-start font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="p-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const label = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
