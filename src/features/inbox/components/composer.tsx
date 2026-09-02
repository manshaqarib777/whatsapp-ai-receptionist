'use client';

import { Paperclip, Send, Smile } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useSendMessage,
  useSetTyping,
  useUploadAttachment,
} from '@/features/inbox/hooks/use-inbox';
import { VoiceRecorder } from '@/features/voice/components/voice-recorder';
import { VoiceCommandControl } from '@/features/voice/components/voice-command';

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
function throttled(lastRun: { current: number }, now: number, windowMs: number): boolean {
  if (now - lastRun.current < windowMs) return false;
  lastRun.current = now;
  return true;
}

export function Composer({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState('');
  const sendMessage = useSendMessage(conversationId);
  const setTyping = useSetTyping(conversationId);
  const uploadAttachment = useUploadAttachment(conversationId);
  const lastTypingSent = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

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

  function upload(file: File | undefined) {
    if (!file) return;
    uploadAttachment.mutate(file, {
      onSuccess: () => toast.success('Attachment sent.'),
      onError: () => toast.error('Could not upload the attachment.'),
    });
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

        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,audio/mpeg,audio/mp4,audio/ogg,audio/webm"
          aria-label="Choose attachment"
          onChange={(event) => {
            upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Attach a file"
          className="text-muted-foreground shrink-0"
          disabled={uploadAttachment.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip aria-hidden="true" className="size-4" />
        </Button>
        <VoiceRecorder disabled={uploadAttachment.isPending} onRecorded={upload} />
        <VoiceCommandControl onDraft={setValue} />

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
          className="max-h-32 min-h-10 flex-1"
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
