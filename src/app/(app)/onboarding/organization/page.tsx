import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CreateOrganizationForm } from '@/features/auth/components/create-organization-form';
import * as organizationService from '@/features/auth/services/organization.service';
import { requireAuth } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Create your organization' };

export default async function OnboardingPage() {
  const { user } = await requireAuth();

  // Already onboarded — do not show this again.
  const organizations = await organizationService.listForUser(user.id);
  if (organizations.length > 0) redirect('/dashboard');

  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your organization
        </h1>
        <p className="text-muted-foreground text-sm">
          This is where your conversations, contacts, and team live. You can create more
          later.
        </p>
      </div>

      <CreateOrganizationForm />
    </div>
  );
}
