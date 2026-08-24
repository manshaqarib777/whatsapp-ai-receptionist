'use client';

import { Building2, Check, ChevronsUpDown, LogOut, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { OrganizationSummary } from '@/features/auth/services/organization.service';
import {
  switchActiveBranch,
  switchActiveOrganization,
} from '@/features/auth/services/members.client';
import type { BranchSummary } from '@/features/organizations/services/branches.service';
import { ROLE_LABELS, type Role } from '@/features/auth/permissions';
import type { AuthUser } from '@/server/auth-context';
import { signOutAccount } from '@/features/auth/services/account.client';

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
 * Tracks whether the surrounding rail is collapsed.
 *
 * `SidebarNav` marks its `<nav>` with `data-collapsed`; the switcher lives inside
 * that nav, so reading the attribute from the nearest ancestor is how it stays in
 * sync with `AppShell`'s internal collapse state without changing the M3 shell.
 */
function useSidebarCollapsed(): {
  collapsed: boolean;
  ref: React.RefObject<HTMLDivElement | null>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const nav = ref.current?.closest('nav[data-collapsed]');
    const update = () => setCollapsed(nav?.getAttribute('data-collapsed') === 'true');
    update();

    const observer = new MutationObserver(update);
    if (nav)
      observer.observe(nav, { attributes: true, attributeFilter: ['data-collapsed'] });

    return () => observer.disconnect();
  }, []);

  return { collapsed, ref };
}

/**
 * Sidebar header slot — the workspace switcher.
 *
 * Lives inside the sidebar's 56px top bar. Collapsed, it shows a mark; expanded,
 * the active organization name with a switcher. The switcher writes the active
 * organization to the session row and refreshes so every scoped query re-scopes.
 */

export function SidebarWorkspaceSwitcher({
  organizations,
  activeOrganizationId,
  branches,
  activeBranchId,
}: {
  organizations: OrganizationSummary[];
  activeOrganizationId: string | null;
  branches: BranchSummary[];
  activeBranchId: string | null;
}) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const { collapsed, ref } = useSidebarCollapsed();

  const active =
    organizations.find((org) => org.id === activeOrganizationId) ?? organizations[0];

  if (!active) return null;
  const currentOrganizationId = active.id;
  const activeBranch =
    branches.find((branch) => branch.id === activeBranchId) ?? branches[0];

  async function switchOrganization(organizationId: string) {
    if (organizationId === currentOrganizationId) return;
    setIsSwitching(true);

    try {
      await switchActiveOrganization(organizationId);
      router.refresh();
    } finally {
      setIsSwitching(false);
    }
  }

  async function switchBranch(branchId: string) {
    if (branchId === activeBranch?.id) return;
    setIsSwitching(true);
    try {
      await switchActiveBranch(branchId);
      router.refresh();
    } finally {
      setIsSwitching(false);
    }
  }

  if (collapsed) {
    return (
      <span
        ref={ref}
        className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-semibold"
      >
        {active.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <div ref={ref} className="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSwitching}
            aria-label={`Current organization: ${active.name}. Switch organization`}
            className="w-full justify-start gap-2 px-2"
          >
            <Building2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-start">
              {active.name}
              {activeBranch ? ` · ${activeBranch.name}` : ''}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
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
          {branches.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Branches</DropdownMenuLabel>
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onSelect={() => void switchBranch(branch.id)}
                  className="gap-2"
                >
                  <Check
                    aria-hidden="true"
                    className={
                      branch.id === activeBranch?.id ? 'size-4' : 'size-4 opacity-0'
                    }
                  />
                  <span className="flex-1 truncate">{branch.name}</span>
                  {branch.isDefault ? <Badge variant="outline">Default</Badge> : null}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Sidebar footer slot — the account menu.
 *
 * Pinned to the bottom of the rail so the item list scrolls, this does not.
 */

export function SidebarAccountMenu({ user }: { user: AuthUser }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Account menu"
          className="w-full gap-2 px-2"
        >
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-start">{user.name}</span>
          <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
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

        <DropdownMenuItem asChild>
          <Link href="/settings/integrations">
            <Settings aria-hidden="true" className="size-4" />
            Integrations
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={async () => {
            await signOutAccount();
            router.push('/login');
            router.refresh();
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
