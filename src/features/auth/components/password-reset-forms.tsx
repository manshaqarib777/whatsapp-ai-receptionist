'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { TextField } from '@/components/form-field';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/features/auth/validators/auth.validators';
import { authClient } from '@/lib/auth-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function collectErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

/**
 * Request a password reset.
 *
 * Always reports success. Revealing whether an address is registered would make this
 * an account-enumeration endpoint (SECURITY_RULES.md → Enumeration).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      setErrors(collectErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setIsPending(true);

    await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: '/reset-password',
    });

    setIsPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center" role="status">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          If an account exists for that address, we have sent a link to reset your
          password. It expires in one hour.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we will send you a link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors['email']}
          autoComplete="email"
          required
          autoFocus
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/** Set a new password from an emailed, single-use, one-hour token. */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Link is not valid</h1>
        <p className="text-muted-foreground text-sm">
          This reset link is missing or malformed. Request a new one.
        </p>
        <Button asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });

    if (!parsed.success) {
      setErrors(collectErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setIsPending(true);

    const { error } = await authClient.resetPassword({
      newPassword: parsed.data.password,
      token,
    });

    setIsPending(false);

    if (error) {
      setFormError('This link has expired or has already been used. Request a new one.');
      return;
    }

    router.push('/login?reset=1');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="New password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors['password']}
          autoComplete="new-password"
          hint="At least 12 characters."
          required
          autoFocus
        />

        <TextField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors['confirmPassword']}
          autoComplete="new-password"
          required
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
