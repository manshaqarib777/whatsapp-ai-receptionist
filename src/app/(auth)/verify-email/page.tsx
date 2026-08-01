import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Verify your email' };

export default function VerifyEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Verify your email</h1>
      <p className="text-muted-foreground text-sm">
        Open the link we sent to your email address to finish setting up your account. The
        link expires in 24 hours.
      </p>
      <Button asChild variant="outline">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
