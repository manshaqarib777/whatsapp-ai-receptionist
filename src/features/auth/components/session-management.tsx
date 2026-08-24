'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  listAccountSessions,
  revokeAccountSession,
  type AccountSession,
} from '@/features/auth/services/account.client';

export function SessionManagement({ currentSessionId }: { currentSessionId: string }) {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listAccountSessions()
      .then(setSessions)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load sessions.'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function revoke(session: AccountSession) {
    setPendingToken(session.token);
    setError(null);
    try {
      await revokeAccountSession(session.token);
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not revoke that session.',
      );
    } finally {
      setPendingToken(null);
    }
  }

  return (
    <section className="rounded-2xl border p-6" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="font-semibold">
        Active sessions
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Devices currently signed in to your account.
      </p>
      {error ? (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="mt-4 text-sm">
          Loading sessions…
        </p>
      ) : null}
      {!loading && sessions.length === 0 ? (
        <p className="mt-4 text-sm">No active sessions.</p>
      ) : null}
      <ul className="mt-4 divide-y">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {session.userAgent || 'Unknown device'}
              </p>
              <p className="text-muted-foreground text-xs">
                {session.id === currentSessionId
                  ? 'This device'
                  : session.ipAddress || 'IP unavailable'}
              </p>
            </div>
            {session.id !== currentSessionId ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pendingToken === session.token}
                onClick={() => void revoke(session)}
              >
                {pendingToken === session.token ? 'Revoking…' : 'Revoke'}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
