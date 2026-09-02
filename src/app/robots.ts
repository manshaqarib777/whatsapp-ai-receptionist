import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { serverAppUrl } from '@/lib/env';

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const origin = serverAppUrl;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard/',
        '/settings/',
        '/inbox/',
        '/contacts/',
        '/appointments/',
        '/crm/',
        '/quotes/',
        '/invoices/',
        '/workflows/',
        '/broadcast/',
        '/analytics/',
        '/knowledge/',
        '/reviews/',
        '/loyalty/',
        '/design/',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
