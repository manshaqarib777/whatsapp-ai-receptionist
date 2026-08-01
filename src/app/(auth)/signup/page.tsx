import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { configuredProviders } from '@/features/auth/configured-providers';
import { SignupForm } from '@/features/auth/components/signup-form';
import { getAuthContext } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignupPage() {
  const context = await getAuthContext();
  if (context) redirect('/dashboard');

  return <SignupForm providers={configuredProviders()} />;
}
