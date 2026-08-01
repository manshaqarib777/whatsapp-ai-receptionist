'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { MemberSummary } from '@/features/auth/services/organization.service';
import {
  ROLE_LABELS,
  ROLE_ORDER,
  canAssignRole,
  hasPermission,
  type Role,
} from '@/features/auth/permissions';

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
 * Member list with role management.
 *
 * `canAssignRole` is used here to decide what to OFFER. That is a presentation aid
 * only — the same check runs server-side in organization.service.ts, which is what
 * actually enforces it. Hiding a menu item is not authorization
 * (SECURITY_RULES.md).
 */
export function MembersTable({
  members,
  currentUserId,
  currentRole,
}: {
  members: MemberSummary[];
  currentUserId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasPermission(currentRole, 'member:update');

  async function changeRole(memberId: string, role: Role) {
    setPendingId(memberId);
    setError(null);

    const response = await fetch(`/api/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(payload?.error?.message ?? 'Could not change that role.');
      return;
    }

    router.refresh();
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center">
        <p className="text-sm font-medium">No members yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Invite a colleague to share this organization with them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Members of this organization and their roles
          </caption>
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-accent border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {member.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? '')
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name}
                        {member.userId === currentUserId ? (
                          <span className="text-muted-foreground ms-1 font-normal">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {ROLE_LABELS[member.role as Role] ?? member.role}
                  </Badge>
                </td>

                <td className="px-4 py-3 text-end">
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === member.id}
                          aria-label={`Change role for ${member.name}`}
                        >
                          {pendingId === member.id ? 'Saving…' : 'Change role'}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Set role</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {ROLE_ORDER.filter((role) =>
                          canAssignRole(currentRole, role),
                        ).map((role) => (
                          <DropdownMenuItem
                            key={role}
                            disabled={role === member.role}
                            onSelect={() => void changeRole(member.id, role)}
                          >
                            {ROLE_LABELS[role]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
