'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { TextField } from '@/components/form-field';
import {
  backupCodeSchema,
  twoFactorCodeSchema,
} from '@/features/auth/validators/auth.validators';
import { DEFAULT_REDIRECT, safeRedirect } from '@/features/auth/validators/redirect';
import { authClient } from '@/lib/auth-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

/**
 * Two-factor challenge.
 *
 * Offers the TOTP code with a backup-code fallback — an authenticator on a lost
 * phone must not lock a user out permanently.
 */
export function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get('next'), DEFAULT_REDIRECT);

  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  async function handleTotpSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = twoFactorCodeSchema.safeParse({ code });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);
    setIsPending(true);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code: parsed.data.code,
    });

    setIsPending(false);

    if (verifyError) {
      setError('That code is not correct or has expired. Try the next one.');
      setCode('');
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleBackupSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = backupCodeSchema.safeParse({ code: backupCode });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);
    setIsPending(true);

    const { error: verifyError } = await authClient.twoFactor.verifyBackupCode({
      code: parsed.data.code,
    });

    setIsPending(false);

    if (verifyError) {
      setError('That backup code is not valid, or has already been used.');
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-muted-foreground text-sm">
          {useBackupCode
            ? 'Enter one of the backup codes you saved.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {useBackupCode ? (
        <form onSubmit={handleBackupSubmit} noValidate className="space-y-4">
          <TextField
            label="Backup code"
            name="backupCode"
            value={backupCode}
            onChange={setBackupCode}
            error={fieldError}
            autoComplete="one-time-code"
            required
            autoFocus
          />

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totp-code">Authentication code</Label>
            <InputOTP
              id="totp-code"
              maxLength={6}
              value={code}
              onChange={setCode}
              aria-describedby={fieldError ? 'totp-error' : undefined}
              aria-invalid={fieldError ? true : undefined}
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p id="totp-error" className="text-destructive min-h-4 text-xs" role="alert">
              {fieldError ?? ''}
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setUseBackupCode(!useBackupCode);
          setError(null);
          setFieldError(undefined);
        }}
      >
        {useBackupCode ? 'Use your authenticator app' : 'Use a backup code instead'}
      </Button>
    </div>
  );
}
