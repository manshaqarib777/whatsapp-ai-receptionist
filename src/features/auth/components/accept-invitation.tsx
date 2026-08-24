'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { acceptOrganizationInvitation } from '@/features/auth/services/account.client';

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await acceptOrganizationInvitation(invitationId);
      router.push('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not accept the invitation.',
      );
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border p-6">
      <h1 className="text-2xl font-semibold">Organization invitation</h1>
      <p className="text-muted-foreground text-sm">
        Accept this invitation to join the organization. Invitations expire after 48
        hours.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button onClick={() => void accept()} disabled={pending}>
        {pending ? 'Accepting…' : 'Accept invitation'}
      </Button>
    </div>
  );
}
