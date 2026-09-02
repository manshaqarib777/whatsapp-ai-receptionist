export async function createPrivacyRequest(input: {
  contactId: string;
  type: 'access' | 'erasure';
}) {
  return request('/api/privacy/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function processPrivacyRequest(
  id: string,
  input: { version: number; confirmation?: string },
) {
  return request(`/api/privacy/requests/${id}/process`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Privacy request failed.');
  return body.data;
}
