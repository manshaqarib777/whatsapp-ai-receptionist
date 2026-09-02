import type { Metadata } from 'next';

import { TwoFactorSettings } from '@/features/auth/components/two-factor-settings';
import { SessionManagement } from '@/features/auth/components/session-management';
import { requireAuth } from '@/server/auth-context';
import { hasPermission } from '@/features/auth/permissions';
import * as privacy from '@/features/privacy/privacy.service';
import { PrivacyRequests } from '@/features/privacy/components/privacy-requests';

export const metadata: Metadata = { title: 'Security' };

// Session reads make this page request-time only; it must never be statically
// prerendered (a prerender has no session headers).
export const dynamic = 'force-dynamic';

export default async function SecuritySettingsPage() {
  const context = await requireAuth();
  const { user, sessionId } = context;
  const canManagePrivacy = Boolean(
    context.organizationId &&
    context.role &&
    hasPermission(context.role, 'settings:update'),
  );
  const privacyData =
    canManagePrivacy && context.organizationId
      ? await Promise.all([
          privacy.targets(context.organizationId),
          privacy.list(context.organizationId),
        ])
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-muted-foreground text-sm">
          Manage how you sign in to your account.
        </p>
      </div>

      <TwoFactorSettings enabled={user.twoFactorEnabled} />
      <SessionManagement currentSessionId={sessionId} />
      {privacyData ? (
        <PrivacyRequests targets={privacyData[0]} requests={privacyData[1]} />
      ) : null}
    </div>
  );
}
