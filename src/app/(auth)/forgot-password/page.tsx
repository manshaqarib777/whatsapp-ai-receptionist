import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/features/auth/components/password-reset-forms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
