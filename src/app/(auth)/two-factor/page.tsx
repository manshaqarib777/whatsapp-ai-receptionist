import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TwoFactorForm } from '@/features/auth/components/two-factor-form';

import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Two-factor authentication' };

export default function TwoFactorPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      }
    >
      <TwoFactorForm />
    </Suspense>
  );
}
