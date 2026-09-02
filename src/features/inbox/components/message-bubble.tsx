'use client';

import { FileText, Mic } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MessageRow } from '@/features/inbox/repositories/inbox.repository';
import { ListenButton, VoiceTranscript } from '@/features/voice/components/voice-actions';

/**
 * One message bubble in the thread.
 *
 * Inbound (contact) messages render on the start side, outbound on the end side.
 * Attachments render as a document card or an audio player (voice, AD-7). Emoji-
 * only messages render large. Author type (`agent` vs `ai` vs `contact`) is
 * surfaced per AI_ENGINE_RULES.md → Human Handover ("Every message records its
 * author type … surfaced in the UI").
 */

export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

function AuthorLabel({ type }: { type: string }) {
  if (type === 'agent') return <Badge variant="secondary">Agent</Badge>;
  if (type === 'ai') return <Badge variant="outline">AI</Badge>;
  return null;
}

export function MessageBubble({ message }: { message: MessageRow }) {
  const inbound = message.direction === 'inbound';
  const isEmojiOnly =
    message.contentType === 'text' &&
    !!message.body &&
    /^[\p{Emoji_Presentation}\s]+$/u.test(message.body.trim());

  const attachment = message.attachments[0];

  const time = useMemo(() => formatMessageTime(message.createdAt), [message.createdAt]);

  return (
    <div className={cn('flex w-full', inbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
          inbound
            ? 'bg-muted text-foreground rounded-es-sm'
            : 'bg-primary text-primary-foreground rounded-ee-sm',
        )}
      >
        <div className="mb-0.5 flex items-center gap-2">
          <AuthorLabel type={message.authorType} />
          <span
            className={cn(
              'text-xs tabular-nums',
              inbound ? 'text-muted-foreground' : 'text-primary-foreground/70',
            )}
          >
            {time}
          </span>
        </div>

        {attachment ? (
          <AttachmentCard
            fileName={attachment.fileName ?? 'attachment'}
            mimeType={attachment.mimeType}
            contentType={message.contentType}
            downloadUrl={attachment.downloadUrl}
          />
        ) : null}

        {message.body ? (
          <p className={cn('break-words whitespace-pre-wrap', isEmojiOnly && 'text-2xl')}>
            {message.body}
          </p>
        ) : null}
        {message.body ? <ListenButton text={message.body} /> : null}
        {(message.contentType === 'audio' || attachment?.mimeType.startsWith('audio/')) &&
        attachment ? (
          <VoiceTranscript messageId={message.id} attachmentId={attachment.id} />
        ) : null}

        {message.deliveryStatus === 'read' ? (
          <p
            className={cn(
              'mt-0.5 text-xs',
              inbound ? 'text-muted-foreground' : 'text-primary-foreground/70',
            )}
          >
            Read
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentCard({
  fileName,
  mimeType,
  contentType,
  downloadUrl,
}: {
  fileName: string;
  mimeType: string;
  contentType: string;
  downloadUrl: string;
}) {
  const isAudio = contentType === 'audio' || mimeType.startsWith('audio/');

  if (isAudio) {
    return (
      <div className="mb-1.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Mic aria-hidden="true" className="size-4" />
          <span className="text-xs font-medium">{fileName}</span>
          <span className="sr-only">voice message</span>
        </div>
        <audio controls preload="none" src={downloadUrl} className="max-w-full">
          <a href={downloadUrl}>Download {fileName}</a>
        </audio>
      </div>
    );
  }

  return (
    <a
      href={downloadUrl}
      className="focus-visible:ring-ring mb-1.5 flex items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <FileText aria-hidden="true" className="size-4" />
      <span className="text-xs font-medium">{fileName}</span>
      <span className="text-xs opacity-70">{mimeType}</span>
    </a>
  );
}
