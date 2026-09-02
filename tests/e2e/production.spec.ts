import { expect, test } from '@playwright/test';

test('exposes separate liveness/readiness probes with trace context', async ({
  request,
}) => {
  const incoming = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
  const live = await request.get('/api/health/live', {
    headers: { traceparent: incoming },
  });
  expect(live.status()).toBe(200);
  expect((await live.json()).data.status).toBe('ok');
  expect(live.headers()['traceparent']).toMatch(
    /^00-4bf92f3577b34da6a3ce929d0e0e4736-(?!00f067aa0ba902b7)[0-9a-f]{16}-01$/,
  );

  const ready = await request.get('/api/health/ready');
  expect(ready.status()).toBe(200);
  expect((await ready.json()).data.status).toBe('ready');
});

test('publishes safe SEO metadata and excludes private surfaces', async ({ request }) => {
  const home = await request.get('/');
  const html = await home.text();
  expect(html).toContain(
    '<meta name="description" content="AI-powered customer communication for small and medium businesses."',
  );

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /api/');
  expect(robots).toContain('Disallow: /inbox/');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<urlset');
  expect(sitemap).not.toContain('/dashboard');
});
