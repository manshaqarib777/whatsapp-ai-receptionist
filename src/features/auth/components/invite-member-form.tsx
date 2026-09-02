'use client';

import { useState } from 'react';

import { TextField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { inviteMember } from '@/features/auth/services/members.client';

export function InviteMemberForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await inviteMember(email, role);
      setEmail('');
      setMessage('Invitation sent.');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not send the invitation.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-4" noValidate>
      <h2 className="font-semibold">Invite a member</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <TextField
          label="Email address"
          name="invite-email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <label className="grid gap-2 text-sm font-medium">
          Role
          <select
            className="border-input bg-background h-9 rounded-md border px-3"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <Button type="submit" disabled={pending || !email.trim()}>
          {pending ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
