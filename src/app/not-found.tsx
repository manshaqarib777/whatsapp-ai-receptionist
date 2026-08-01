import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md space-y-2 text-center">
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>

      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
