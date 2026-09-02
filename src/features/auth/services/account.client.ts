'use client';

import { authClient } from '@/lib/auth-client';

export type AccountSession = {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function listAccountSessions(): Promise<AccountSession[]> {
  const { data, error } = await authClient.listSessions();
  if (error || !data) throw new Error('Could not load your sessions.');
  return data;
}

export async function revokeAccountSession(token: string): Promise<void> {
  const { error } = await authClient.revokeSession({ token });
  if (error) throw new Error('Could not revoke that session.');
}

export async function acceptOrganizationInvitation(invitationId: string): Promise<void> {
  const { error } = await authClient.organization.acceptInvitation({ invitationId });
  if (error) throw new Error(error.message ?? 'Could not accept the invitation.');
}

export async function signOutAccount(): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error('Could not sign out.');
}

export async function enableAccountTwoFactor(password: string) {
  const { data, error } = await authClient.twoFactor.enable({ password });
  if (error || !data) throw new Error('That password is not correct.');
  return data;
}

export async function verifyAccountTotp(code: string): Promise<void> {
  const { error } = await authClient.twoFactor.verifyTotp({ code });
  if (error) throw new Error('That code is not correct. Check your authenticator app.');
}

export async function disableAccountTwoFactor(password: string): Promise<void> {
  const { error } = await authClient.twoFactor.disable({ password });
  if (error) throw new Error('That password is not correct.');
}
