import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/features/auth/components/password-reset-forms';

import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
