'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { FormField } from '@/features/auth/components/form-field';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import {
  signInSchema,
  magicLinkSchema,
} from '@/features/auth/validators/auth.validators';
import { DEFAULT_REDIRECT, safeRedirect } from '@/features/auth/validators/redirect';
import { authClient } from '@/lib/auth-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/**
 * Sign-in form.
 *
 * Supports password and magic-link modes. Two behaviours are security requirements
 * rather than UX choices:
 *
 *  1. The error message never distinguishes "no such account" from "wrong password".
 *     Doing so turns the login form into an account-enumeration oracle
 *     (SECURITY_RULES.md → Enumeration).
 *  2. The post-login destination is validated before use — an unchecked `?next=`
 *     is an open-redirect phishing vector.
 */

type Mode = 'password' | 'magic-link';

export function LoginForm({ providers }: { providers: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get('next'), DEFAULT_REDIRECT);

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = signInSchema.safeParse({ email, password });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setIsPending(true);

    const { error, data } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    setIsPending(false);

    if (error) {
      // Deliberately generic — see the note above.
      setFormError('Those details are not correct. Check them and try again.');
      return;
    }

    // The 2FA plugin signals that a second factor is required rather than
    // completing the sign-in.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      router.push(`/two-factor?next=${encodeURIComponent(next)}`);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMagicLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = magicLinkSchema.safeParse({ email });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setIsPending(true);

    await authClient.signIn.magicLink({
      email: parsed.data.email,
      callbackURL: next,
    });

    setIsPending(false);
    // Confirmed regardless of whether the account exists — same reason as above.
    setMagicLinkSent(true);
  }

  if (magicLinkSent) {
    return (
      <div className="space-y-4 text-center" role="status">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          If an account exists for that address, we have sent a sign-in link. It expires
          in 15 minutes.
        </p>
        <Button variant="outline" onClick={() => setMagicLinkSent(false)}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back. Enter your details to continue.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={mode === 'password' ? handlePasswordSubmit : handleMagicLinkSubmit}
        noValidate
        className="space-y-4"
      >
        <FormField
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

        {mode === 'password' ? (
          <div className="space-y-2">
            <FormField
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors['password']}
              autoComplete="current-password"
              required
            />
            <div className="text-end">
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? 'Signing in…'
            : mode === 'password'
              ? 'Sign in'
              : 'Send sign-in link'}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setMode(mode === 'password' ? 'magic-link' : 'password');
          setErrors({});
          setFormError(null);
        }}
      >
        {mode === 'password' ? 'Sign in with a link instead' : 'Use a password instead'}
      </Button>

      {providers.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons providers={providers} callbackUrl={next} />
        </>
      ) : null}

      <p className="text-muted-foreground text-center text-sm">
        Do not have an account?{' '}
        <Link
          href="/signup"
          className="text-foreground focus-visible:ring-ring rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

function fieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const result: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !result[key]) result[key] = issue.message;
  }

  return result;
}
