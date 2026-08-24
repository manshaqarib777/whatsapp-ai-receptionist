import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { env } from '@/lib/env';

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const origin = env.APP_URL ?? env.NEXT_PUBLIC_APP_URL;
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
