'use client';

import type { Role } from '@/features/auth/permissions';

async function request<T = void>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    const payload = (await response.json()) as { data: T };
    return payload.data;
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  throw new Error(payload?.error?.message ?? 'The request could not be completed.');
}

export function changeMemberRole(memberId: string, role: Role): Promise<void> {
  return request(`/api/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function inviteMember(email: string, role: Exclude<Role, 'owner'>): Promise<void> {
  return request('/api/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function createOrganization(input: { name: string; slug?: string }) {
  return request<{ id: string }>('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function switchActiveOrganization(organizationId: string): Promise<void> {
  return request('/api/organizations/active', {
    method: 'PATCH',
    body: JSON.stringify({ organizationId }),
  });
}

export function switchActiveBranch(branchId: string): Promise<void> {
  return request('/api/branches/active', {
    method: 'PATCH',
    body: JSON.stringify({ branchId }),
  });
}
