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

export function configureIntegration(provider: string, input: unknown) {
  return request(`/api/integrations/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
export function testIntegration(provider: string) {
  return request(`/api/integrations/${provider}/test`, { method: 'POST' });
}
export function disconnectIntegration(provider: string) {
  return request(`/api/integrations/${provider}`, { method: 'DELETE' });
}
