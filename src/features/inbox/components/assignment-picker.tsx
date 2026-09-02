'use client';

import { User } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAssignableMembers,
  useUpdateConversation,
} from '@/features/inbox/hooks/use-inbox';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function AssignmentPicker({ conversationId }: { conversationId: string }) {
  const members = useAssignableMembers();
  const update = useUpdateConversation(conversationId);

  function assign(assigneeId: string | null) {
    update.mutate(
      { assigneeId },
      {
        onError: () => toast.error('Could not update the assignment.'),
        onSuccess: () =>
          toast.success(assigneeId ? 'Conversation assigned.' : 'Assignment removed.'),
      },
    );
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Assign to</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => assign(null)}>
        <User aria-hidden="true" className="size-4" />
        Unassigned
      </DropdownMenuItem>
      {members.isPending ? (
        <DropdownMenuItem disabled>Loading members…</DropdownMenuItem>
      ) : null}
      {members.isError ? (
        <DropdownMenuItem disabled>Members could not be loaded</DropdownMenuItem>
      ) : null}
      {(members.data ?? []).map((member) => (
        <DropdownMenuItem key={member.userId} onClick={() => assign(member.userId)}>
          <User aria-hidden="true" className="size-4" />
          <span className="min-w-0 truncate">{member.name || member.email}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
