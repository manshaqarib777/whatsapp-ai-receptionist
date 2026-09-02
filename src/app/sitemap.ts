import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { serverAppUrl } from '@/lib/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return [
    {
      url: serverAppUrl,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
