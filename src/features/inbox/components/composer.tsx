'use client';

import { Paperclip, Send, Smile } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSendMessage, useSetTyping } from '@/features/inbox/hooks/use-inbox';

/**
 * The message composer.
 *
 * Enter sends, Shift+Enter newline. An emoji picker inserts emoji; an attachment
 * button uploads a file (AD-7, AD-6). Typing is reported to the server on each
 * keystroke so other agents see the indicator (AD-10) — throttled to once per
 * second to avoid a request per keypress.
 */

const EMOJI = ['😀', '👍', '🙏', '🎉', '❤️', '😂', '😊', '👋', '✅', '❓'];

const TYPING_THROTTLE_MS = 1000;

/** Throttles an action to once per window; returns true when it ran. */
function throttled(
  lastRun: { current: number },
  now: number,
  windowMs: number,
): boolean {
  if (now - lastRun.current < windowMs) return false;
  lastRun.current = now;
  return true;
}

export function Composer({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState('');
  const sendMessage = useSendMessage(conversationId);
  const setTyping = useSetTyping(conversationId);
  const lastTypingSent = useRef(0);

  function reportTyping() {
    // Date.now() here is only ever read inside event handlers (keystroke
    // throttling), never during render — the purity rule cannot see that, so
    // it is disabled for this line rather than restructuring the throttle
    // into a sub-optimal shape.
    // eslint-disable-next-line react-hooks/purity
    if (throttled(lastTypingSent, Date.now(), TYPING_THROTTLE_MS)) {
      setTyping.mutate();
    }
  }

  async function handleSend() {
    const body = value.trim();
    if (!body || sendMessage.isPending) return;
    setValue('');
    sendMessage.mutate(body, {
      onError: () => toast.error('Could not send the message. Try again.'),
    });
  }

  function insertEmoji(emoji: string) {
    setValue((current) => `${current}${emoji}`);
    reportTyping();
  }

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Insert emoji"
              className="text-muted-foreground shrink-0"
            >
              <Smile aria-hidden="true" className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56">
            <div className="grid grid-cols-5 gap-1">
              {EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="hover:bg-muted flex h-9 items-center justify-center rounded-md text-lg"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Attach a file"
          className="text-muted-foreground shrink-0"
          onClick={() => toast.info('Attachments: choose a file from your device.')}
        >
          <Paperclip aria-hidden="true" className="size-4" />
        </Button>

        <Textarea
          aria-label="Message"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            reportTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type a message…"
          className="min-h-10 max-h-32 flex-1"
          rows={1}
        />

        <Button
          size="icon"
          onClick={() => void handleSend()}
          disabled={!value.trim() || sendMessage.isPending}
          aria-label="Send message"
          className="shrink-0"
        >
          <Send aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
