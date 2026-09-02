'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Transcript = { status: string; text: string | null; lastError: string | null };

export function VoiceTranscript({
  messageId,
  attachmentId,
}: {
  messageId: string;
  attachmentId: string;
}) {
  const [item, setItem] = useState<Transcript | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      let response = await fetch(`/api/voice/transcriptions/${messageId}`);
      let payload = (await response.json()) as {
        data?: { transcriptions: Transcript[] };
        error?: { message: string };
      };
      if (!payload.data?.transcriptions[0]) {
        response = await fetch('/api/voice/transcriptions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId, attachmentId, language: 'auto' }),
        });
        payload = (await response.json()) as typeof payload;
        if (!response.ok)
          throw new Error(payload.error?.message ?? 'Could not queue transcription.');
        setItem({ status: 'pending', text: null, lastError: null });
        return;
      }
      setItem(payload.data.transcriptions[0] ?? null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 border-t border-current/15 pt-2 text-xs">
      {item?.status === 'completed' ? (
        <p>
          <span className="font-semibold">Transcript:</span> {item.text}
        </p>
      ) : item ? (
        <p role="status">
          Transcript {item.status}
          {item.lastError ? `: ${item.lastError}` : ''}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-1 h-7 px-2"
        disabled={busy}
        onClick={() => void load()}
      >
        {item ? 'Refresh transcript' : 'Transcribe voice note'}
      </Button>
    </div>
  );
}

export function ListenButton({ text }: { text: string }) {
  const [busy, setBusy] = useState(false);
  async function listen() {
    setBusy(true);
    try {
      const response = await fetch('/api/voice/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, voice: 'coral' }),
      });
      if (!response.ok) throw new Error('Could not generate speech.');
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-1 h-7 px-2"
      disabled={busy}
      onClick={() => void listen()}
    >
      {busy ? 'Generating…' : 'Listen'}
    </Button>
  );
}
