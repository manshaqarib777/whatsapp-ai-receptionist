import type { Metadata } from 'next';

import { TwoFactorSettings } from '@/features/auth/components/two-factor-settings';
import { requireAuth } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Security' };

export default async function SecuritySettingsPage() {
  const { user } = await requireAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-muted-foreground text-sm">
          Manage how you sign in to your account.
        </p>
      </div>

      <TwoFactorSettings enabled={user.twoFactorEnabled} />
    </div>
  );
}
