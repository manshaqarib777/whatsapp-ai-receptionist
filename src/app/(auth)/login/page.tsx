import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { configuredProviders } from '@/features/auth/configured-providers';
import { LoginForm } from '@/features/auth/components/login-form';
import { getAuthContext } from '@/server/auth-context';

import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  // An already-authenticated user has no business on the sign-in screen.
  const context = await getAuthContext();
  if (context) redirect('/dashboard');

  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm providers={configuredProviders()} />
    </Suspense>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading sign-in form">
      <Skeleton className="mx-auto h-6 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
