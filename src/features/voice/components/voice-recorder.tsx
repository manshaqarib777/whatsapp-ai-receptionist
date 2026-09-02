'use client';
import { Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      return;
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    recorder.current = new MediaRecorder(stream.current);
    recorder.current.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    recorder.current.onstop = () => {
      const type = recorder.current?.mimeType || 'audio/webm';
      onRecorded(
        new File(
          chunks.current,
          `voice-note-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
          { type },
        ),
      );
      stream.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);
    };
    recorder.current.start();
    setRecording(true);
  }
  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }
  const supported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';
  return (
    <Button
      type="button"
      variant={recording ? 'destructive' : 'ghost'}
      size="icon"
      aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
      disabled={disabled || !supported}
      title={supported ? undefined : 'Voice recording is not supported in this browser'}
      onClick={() => (recording ? stop() : void start())}
    >
      {recording ? (
        <Square aria-hidden="true" className="size-4" />
      ) : (
        <Mic aria-hidden="true" className="size-4" />
      )}
    </Button>
  );
}
