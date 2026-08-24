import { describe, expect, it } from 'vitest';
import { speechProvider } from './speech.provider';

describe('local speech provider', () => {
  it('produces deterministic labelled transcription and valid WAV output', async () => {
    const provider = speechProvider();
    const transcript = await provider.transcribe({
      audio: Buffer.from('demo'),
      mimeType: 'audio/ogg',
      language: 'auto',
      fileName: 'booking.ogg',
    });
    expect(transcript).toMatchObject({
      provider: 'local',
      model: 'demo-stt-v1',
      language: 'en',
    });
    const speech = await provider.synthesize({ text: 'Confirmed', voice: 'coral' });
    expect(speech.audio.subarray(0, 4).toString()).toBe('RIFF');
    expect(speech.mimeType).toBe('audio/wav');
  });
});
