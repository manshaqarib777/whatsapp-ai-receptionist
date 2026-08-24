import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { env } from '@/lib/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return [
    {
      url: env.APP_URL ?? env.NEXT_PUBLIC_APP_URL,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
