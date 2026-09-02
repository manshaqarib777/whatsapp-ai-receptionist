'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNote } from '@/features/inbox/hooks/use-inbox';

export function NoteComposer({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState('');
  const createNote = useCreateNote(conversationId);

  function submit() {
    const value = body.trim();
    if (!value || createNote.isPending) return;
    createNote.mutate(value, {
      onSuccess: () => setBody(''),
      onError: () => toast.error('Could not add the internal note.'),
    });
  }

  return (
    <div className="flex items-end gap-2 border-t px-4 py-2">
      <Textarea
        aria-label="Internal note"
        placeholder="Add an internal note…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-9 flex-1"
        rows={1}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!body.trim() || createNote.isPending}
        onClick={submit}
      >
        Add note
      </Button>
    </div>
  );
}
