import type { Metadata } from 'next';

import { requireAuth } from '@/server/auth-context';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Milestone 2 placeholder.
 *
 * The real dashboard is Milestone 5 and its design is specified in
 * COMPONENT_DESIGN.md → Dashboard. This exists only so authenticated users have
 * somewhere to land; no product widgets belong here yet.
 */
export default async function DashboardPage() {
  const { user, role } = await requireAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {user.name}. Your role is {role ?? 'not set'}.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>
            Authentication is complete. The dashboard is built in Milestone 5.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Milestone 3 builds the design system, Milestone 4 the full data model, and
          Milestone 5 this screen.
        </CardContent>
      </Card>
    </div>
  );
}
