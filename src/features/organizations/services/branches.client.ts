'use client';

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.data)
    throw new Error(payload?.error?.message ?? 'The request failed.');
  return payload.data;
}

export function createBranch(input: { name: string; timezone: string }) {
  return request('/api/branches', { method: 'POST', body: JSON.stringify(input) });
}

export function updateBranch(id: string, input: { name?: string; timezone?: string }) {
  return request(`/api/branches/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function makeDefault(id: string) {
  return request(`/api/branches/${id}/default`, { method: 'PATCH' });
}
