'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BranchSummary } from '@/features/organizations/services/branches.service';
import {
  createBranch,
  makeDefault,
  updateBranch,
} from '@/features/organizations/services/branches.client';

export function BranchesSettings({
  branches,
  canManage,
}: {
  branches: BranchSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {branches.length === 0 ? (
        <p className="text-muted-foreground text-sm">No branches are available.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {branches.map((branch) => (
            <div key={branch.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {branch.name}
                  {branch.isDefault ? ' (Default)' : ''}
                </p>
                <p className="text-muted-foreground text-sm">{branch.timezone}</p>
              </div>
              {canManage ? (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt('Branch name', branch.name)?.trim();
                      if (next && next !== branch.name)
                        void run(() => updateBranch(branch.id, { name: next }));
                    }}
                  >
                    Rename
                  </Button>
                  {!branch.isDefault ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => makeDefault(branch.id))}
                    >
                      Make default
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canManage ? (
        <form
          className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await createBranch({ name, timezone });
              setName('');
            });
          }}
        >
          <Input
            aria-label="Branch name"
            placeholder="Branch name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            aria-label="IANA timezone"
            placeholder="Asia/Riyadh"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
          />
          <Button disabled={busy}>Add branch</Button>
        </form>
      ) : null}
    </div>
  );
}
