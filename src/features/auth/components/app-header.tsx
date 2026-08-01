'use client';

import { Building2, Check, ChevronsUpDown, LogOut, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { OrganizationSummary } from '@/features/auth/services/organization.service';
import type { AuthUser } from '@/server/auth-context';
import { ROLE_LABELS, type Role } from '@/features/auth/permissions';
import { authClient } from '@/lib/auth-client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Authenticated header with an organization switcher and account menu.
 *
 * Milestone 2 scaffold. The real sidebar and navigation are specified in
 * COMPONENT_DESIGN.md and built in Milestone 3/5 — this exists so the auth flows are
 * usable end to end, not as the final navigation.
 */
export function AppHeader({
  user,
  organizations,
  activeOrganizationId,
}: {
  user: AuthUser;
  organizations: OrganizationSummary[];
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const active =
    organizations.find((org) => org.id === activeOrganizationId) ?? organizations[0];

  async function switchOrganization(organizationId: string) {
    if (organizationId === active?.id) return;

    setIsSwitching(true);

    const response = await fetch('/api/organizations/active', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });

    setIsSwitching(false);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="focus-visible:ring-ring rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
          >
            WhatsApp AI Receptionist
          </Link>

          {active ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSwitching}
                  aria-label={`Current organization: ${active.name}. Switch organization`}
                >
                  <Building2 aria-hidden="true" className="size-4" />
                  <span className="max-w-40 truncate">{active.name}</span>
                  <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onSelect={() => void switchOrganization(org.id)}
                    className="gap-2"
                  >
                    {/* Selection is marked by an icon as well as by weight —
                        never by colour alone (DESIGN_RULES.md). */}
                    <Check
                      aria-hidden="true"
                      className={org.id === active.id ? 'size-4' : 'size-4 opacity-0'}
                    />
                    <span className="flex-1 truncate">{org.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[org.role as Role] ?? org.role}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Account menu">
              <Avatar className="size-6">
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/settings/security">
                <Settings aria-hidden="true" className="size-4" />
                Security
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/settings/members">
                <Users aria-hidden="true" className="size-4" />
                Members
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.push('/login');
                router.refresh();
              }}
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
