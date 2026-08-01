import { env } from '@/lib/env';

/**
 * Which OAuth providers are configured.
 *
 * Server-only: reads credentials from the validated environment and returns names
 * alone, so the client learns which buttons to render without ever seeing a secret.
 */
export function configuredProviders(): string[] {
  const providers: string[] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google');
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push('github');

  return providers;
}
