async function patchJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
}

export const updatePlan = (id: string, body: { active: boolean; version: number }) =>
  patchJson(`/api/admin/plans/${id}`, body);
export const updateSubscription = (
  id: string,
  body: { cancelAtPeriodEnd: boolean; version: number },
) => patchJson(`/api/admin/billing/${id}`, body);
