'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createPrivacyRequest, processPrivacyRequest } from '../privacy.client';

type Target = { id: string; displayName: string; redactedAt: Date | string | null };
type PrivacyRow = {
  id: string;
  type: string;
  status: string;
  contactId: string;
  version: number;
  createdAt: Date | string;
  contact: { displayName: string; redactedAt: Date | string | null };
};

export function PrivacyRequests({
  targets,
  requests,
}: {
  targets: Target[];
  requests: PrivacyRow[];
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState(targets[0]?.id ?? '');
  const [type, setType] = useState<'access' | 'erasure'>('access');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createPrivacyRequest({ contactId, type });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Privacy request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function process(row: PrivacyRow) {
    setBusy(true);
    setError(null);
    try {
      const result = await processPrivacyRequest(row.id, {
        version: row.version,
        ...(row.type === 'erasure' ? { confirmation } : {}),
      });
      if (row.type === 'access')
        downloadJson(`privacy-export-${row.contactId}.json`, result.data);
      setConfirmation('');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Privacy request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-labelledby="privacy-heading"
    >
      <div>
        <h2 id="privacy-heading" className="font-semibold">
          Privacy requests
        </h2>
        <p className="text-muted-foreground text-sm">
          Create a bounded customer export or confirmed erasure request.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <label className="grid gap-1 text-sm">
          Contact
          <select
            className="border-input bg-background h-9 rounded-md border px-3"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
          >
            {targets
              .filter((target) => !target.redactedAt)
              .map((target) => (
                <option key={target.id} value={target.id}>
                  {target.displayName}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Request
          <select
            className="border-input bg-background h-9 rounded-md border px-3"
            value={type}
            onChange={(event) => setType(event.target.value as 'access' | 'erasure')}
          >
            <option value="access">Access export</option>
            <option value="erasure">Erasure</option>
          </select>
        </label>
        <Button
          className="self-end"
          disabled={busy || !contactId}
          onClick={() => void create()}
        >
          Create request
        </Button>
      </div>
      <div className="space-y-3">
        {requests.length ? (
          requests.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3"
            >
              <div className="min-w-40 flex-1">
                <p className="font-medium">{row.contact.displayName}</p>
                <p className="text-muted-foreground text-xs">
                  {row.type} · {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge variant={row.status === 'completed' ? 'default' : 'secondary'}>
                {row.status}
              </Badge>
              {row.status === 'pending' && row.type === 'erasure' ? (
                <Input
                  aria-label="Erasure confirmation"
                  className="w-44"
                  placeholder="ERASE CONTACT"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              ) : null}
              {row.status === 'pending' ? (
                <Button
                  size="sm"
                  variant={row.type === 'erasure' ? 'destructive' : 'outline'}
                  disabled={busy}
                  onClick={() => void process(row)}
                >
                  {row.type === 'access' ? 'Export JSON' : 'Erase contact'}
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No privacy requests yet.</p>
        )}
      </div>
    </section>
  );
}

function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
