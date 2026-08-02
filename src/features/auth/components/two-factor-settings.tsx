'use client';

import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';

import { TextField } from '@/components/form-field';
import { authClient } from '@/lib/auth-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * TOTP enrolment and removal.
 *
 * Two deliberate behaviours:
 *  - The password is re-requested before enabling or disabling. Changing a second
 *    factor from an unattended session is exactly the attack 2FA defends against.
 *  - Backup codes are shown exactly ONCE, at enrolment, and the user must confirm
 *    they have saved them before the flow closes.
 */

type Stage = 'idle' | 'password' | 'verify' | 'backup-codes';

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);

  async function beginEnable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
    });

    setIsPending(false);

    if (enableError || !data) {
      setError('That password is not correct.');
      return;
    }

    setTotpUri(data.totpURI);
    setBackupCodes(data.backupCodes);
    setPassword('');
    setStage('verify');
  }

  async function confirmEnable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });

    setIsPending(false);

    if (verifyError) {
      setError('That code is not correct. Check your authenticator app.');
      setCode('');
      return;
    }

    setIsEnabled(true);
    setStage('backup-codes');
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const { error: disableError } = await authClient.twoFactor.disable({ password });

    setIsPending(false);

    if (disableError) {
      setError('That password is not correct.');
      return;
    }

    setIsEnabled(false);
    setPassword('');
    setStage('idle');
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEnabled ? (
            <ShieldCheck aria-hidden="true" className="size-5 text-emerald-600" />
          ) : (
            <ShieldOff aria-hidden="true" className="text-muted-foreground size-5" />
          )}
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          {isEnabled
            ? 'Enabled. You are asked for a code from your authenticator app when you sign in.'
            : 'Add a second step when signing in, using an authenticator app.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {stage === 'idle' ? (
          <Button
            variant={isEnabled ? 'outline' : 'default'}
            onClick={() => {
              setStage('password');
              setError(null);
            }}
          >
            {isEnabled ? 'Turn off two-factor' : 'Turn on two-factor'}
          </Button>
        ) : null}

        {stage === 'password' ? (
          <form
            onSubmit={isEnabled ? disable : beginEnable}
            noValidate
            className="space-y-4"
          >
            <TextField
              label="Confirm your password"
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              autoFocus
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Checking…' : 'Continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStage('idle');
                  setPassword('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {stage === 'verify' && totpUri ? (
          <form onSubmit={confirmEnable} noValidate className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Add this to your authenticator app</p>
              <p className="text-muted-foreground text-xs">
                Scan the QR code in your app, or enter the setup key manually.
              </p>
              {/* The URI is shown as selectable text rather than only as a QR image,
                  so it is usable on the device running the browser and by screen
                  reader users. */}
              <code className="bg-muted block overflow-x-auto rounded-lg p-3 text-xs break-all">
                {totpUri}
              </code>
            </div>

            <TextField
              label="Enter the 6-digit code"
              name="code"
              value={code}
              onChange={setCode}
              autoComplete="one-time-code"
              required
            />

            <Button type="submit" disabled={isPending}>
              {isPending ? 'Verifying…' : 'Verify and enable'}
            </Button>
          </form>
        ) : null}

        {stage === 'backup-codes' ? (
          <div className="space-y-4" role="status">
            <Alert>
              <AlertDescription>
                Save these backup codes now. Each works once, and they are not shown
                again. They are the only way in if you lose your authenticator.
              </AlertDescription>
            </Alert>

            <ul className="bg-muted grid grid-cols-2 gap-2 rounded-lg p-4 font-mono text-sm">
              {backupCodes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>

            <Button
              onClick={() => {
                setBackupCodes([]);
                setTotpUri(null);
                setStage('idle');
              }}
            >
              I have saved these codes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
