'use client';
import { AudioLines } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Command = {
  kind: string;
  query?: string;
  text?: string;
  requiresConfirmation: boolean;
};
export function VoiceCommandControl({ onDraft }: { onDraft: (text: string) => void }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState('');
  const [command, setCommand] = useState<Command | null>(null);
  async function interpret() {
    const response = await fetch('/api/voice/commands/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: phrase }),
    });
    const payload = (await response.json()) as { data?: { command: Command } };
    if (payload.data) setCommand(payload.data.command);
  }
  function apply() {
    if (command?.kind === 'open_inbox') router.push('/inbox');
    if (command?.kind === 'search' && command.query)
      router.push(`/inbox?q=${encodeURIComponent(command.query)}`);
    if (command?.kind === 'draft_reply' && command.text) onDraft(command.text);
    setCommand(null);
    setPhrase('');
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Voice commands">
          <AudioLines aria-hidden="true" className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div>
          <p className="font-medium">Voice command</p>
          <p className="text-muted-foreground text-xs">
            Speech recognition varies by browser. Type the recognized phrase as a
            fallback.
          </p>
        </div>
        <label className="space-y-1 text-sm">
          <span>Recognized phrase</span>
          <Input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder="Draft Your appointment is confirmed"
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={!phrase.trim()}
          onClick={() => void interpret()}
        >
          Interpret
        </Button>
        {command ? (
          <div role="status" className="rounded-md border p-2 text-sm">
            <p>Proposed action: {command.kind.replaceAll('_', ' ')}</p>
            {command.requiresConfirmation ? (
              <Button type="button" size="sm" className="mt-2" onClick={apply}>
                Confirm draft
              </Button>
            ) : command.kind !== 'unknown' ? (
              <Button type="button" size="sm" className="mt-2" onClick={apply}>
                Run command
              </Button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
