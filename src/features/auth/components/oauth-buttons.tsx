'use client';

import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';

/**
 * Social sign-in buttons.
 *
 * Rendered only for providers the server reports as configured — a provider without
 * credentials must not appear as a dead button (MILESTONE_02_PLAN.md, Risk 2).
 */

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
};

export function OAuthButtons({
  providers,
  callbackUrl,
}: {
  providers: string[];
  callbackUrl: string;
}) {
  const [pending, setPending] = useState<string | null>(null);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={async () => {
            setPending(provider);
            await authClient.signIn.social({
              provider: provider as 'google' | 'github',
              callbackURL: callbackUrl,
            });
            // No reset: the browser navigates away to the provider.
          }}
        >
          {pending === provider
            ? `Redirecting to ${PROVIDER_LABELS[provider] ?? provider}…`
            : `Continue with ${PROVIDER_LABELS[provider] ?? provider}`}
        </Button>
      ))}
    </div>
  );
}
