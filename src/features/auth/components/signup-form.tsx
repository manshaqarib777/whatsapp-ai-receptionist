'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormField } from '@/features/auth/components/form-field';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { signUpSchema } from '@/features/auth/validators/auth.validators';

import { authClient } from '@/lib/auth-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/**
 * Sign-up form.
 *
 * Like sign-in, the outcome is deliberately indistinguishable for an existing
 * address: an attacker must not be able to discover who has an account by attempting
 * to register (SECURITY_RULES.md → Enumeration). Both paths show "check your email".
 */
export function SignupForm({ providers }: { providers: string[] }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = signUpSchema.safeParse({ name, email, password });

    if (!parsed.success) {
      const result: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !result[key]) result[key] = issue.message;
      }
      setErrors(result);
      return;
    }

    setErrors({});
    setIsPending(true);

    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    setIsPending(false);

    if (error) {
      // Every error is surfaced. Enumeration resistance is handled by the auth
      // layer itself, which returns 200 with no token for an address that already
      // exists — so the duplicate case never reaches here.
      //
      // An earlier version treated 400/422 as success to mask duplicates. That
      // masked a genuine backend failure instead: signup was broken for weeks of
      // commits while the E2E test still passed, because the UI showed "Check your
      // email" for a request that created nothing. Never swallow an error class to
      // hide one case within it.
      setFormError('We could not create your account. Please try again.');
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center" role="status">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We have sent a verification link to your email address. Open it to finish
          setting up your account.
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
        <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-muted-foreground text-sm">
          Start answering customer messages automatically.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField
          label="Name"
          name="name"
          value={name}
          onChange={setName}
          error={errors['name']}
          autoComplete="name"
          required
          autoFocus
        />

        <FormField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors['email']}
          autoComplete="email"
          required
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors['password']}
          autoComplete="new-password"
          hint="At least 12 characters. Length matters more than symbols."
          required
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      {providers.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons providers={providers} callbackUrl="/dashboard" />
        </>
      ) : null}

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-foreground focus-visible:ring-ring rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
