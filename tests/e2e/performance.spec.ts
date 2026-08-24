import { expect, test } from '@playwright/test';

test('reports the configured Redis cache without leaking infrastructure details', async ({
  request,
}) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.data.checks.redis).toBe('ok');
  expect(JSON.stringify(body)).not.toContain('redis://');
  expect(JSON.stringify(body)).not.toContain('6380');
});

test('serves immutable framework assets with long-lived cache headers', async ({
  request,
}) => {
  const home = await request.get('/login');
  expect(home.status()).toBe(200);
  const html = await home.text();
  const asset = html.match(/(?:src|href)="([^\"]+\.(?:js|css)[^\"]*)"/)?.[1];
  expect(asset).toBeTruthy();
  if (!asset) throw new Error('Expected the login page to reference a static asset.');

  const response = await request.get(asset);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('immutable');
});
