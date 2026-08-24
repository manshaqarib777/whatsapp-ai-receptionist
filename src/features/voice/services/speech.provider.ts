import { env } from '@/lib/env';
import { UpstreamError } from '@/lib/errors';
import OpenAI, { toFile } from 'openai';

export type TranscriptionResult = {
  text: string;
  language: string;
  confidence: number;
  provider: string;
  model: string;
};

export interface SpeechProvider {
  transcribe(input: {
    audio: Buffer;
    mimeType: string;
    language: string;
    fileName?: string | null;
  }): Promise<TranscriptionResult>;
  synthesize(input: {
    text: string;
    voice: string;
  }): Promise<{ audio: Buffer; mimeType: string; provider: string; model: string }>;
}

class LocalSpeechProvider implements SpeechProvider {
  async transcribe(input: { audio: Buffer; language: string; fileName?: string | null }) {
    if (input.audio.length === 0) throw new UpstreamError('The audio file is empty.');
    return {
      text: `Demo transcript for ${input.fileName ?? 'voice note'}: I would like to confirm my appointment tomorrow.`,
      language: input.language === 'auto' ? 'en' : input.language,
      confidence: 0.98,
      provider: 'local',
      model: 'demo-stt-v1',
    };
  }
  async synthesize(input: { text: string }) {
    return {
      audio: createDemoWav(input.text),
      mimeType: 'audio/wav',
      provider: 'local',
      model: 'demo-tts-v1',
    };
  }
}

class OpenAiSpeechProvider implements SpeechProvider {
  private readonly client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  async transcribe(input: {
    audio: Buffer;
    mimeType: string;
    language: string;
    fileName?: string | null;
  }) {
    try {
      const result = await this.client.audio.transcriptions.create({
        file: await toFile(input.audio, input.fileName ?? 'voice-note', {
          type: input.mimeType,
        }),
        model: env.SPEECH_TO_TEXT_MODEL,
        ...(input.language === 'auto' ? {} : { language: input.language }),
      });
      return {
        text: result.text,
        language: input.language,
        confidence: 0,
        provider: 'openai',
        model: env.SPEECH_TO_TEXT_MODEL,
      };
    } catch (cause) {
      throw new UpstreamError('Speech transcription failed.', cause);
    }
  }
  async synthesize(input: { text: string; voice: string }) {
    try {
      const response = await this.client.audio.speech.create({
        model: env.TEXT_TO_SPEECH_MODEL,
        voice: input.voice,
        input: input.text,
        response_format: 'mp3',
      });
      return {
        audio: Buffer.from(await response.arrayBuffer()),
        mimeType: 'audio/mpeg',
        provider: 'openai',
        model: env.TEXT_TO_SPEECH_MODEL,
      };
    } catch (cause) {
      throw new UpstreamError('Speech generation failed.', cause);
    }
  }
}

export function speechProvider(): SpeechProvider {
  return env.SPEECH_PROVIDER === 'openai'
    ? new OpenAiSpeechProvider()
    : new LocalSpeechProvider();
}

/** Produces a valid short WAV confirmation tone; local mode is explicitly demo-only. */
function createDemoWav(text: string): Buffer {
  const sampleRate = 8000;
  const seconds = Math.min(2, Math.max(0.35, text.length / 250));
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + dataSize, 4);
  output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.min(1, index / 160, (samples - index) / 160);
    output.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 5000 * envelope),
      44 + index * 2,
    );
  }
  return output;
}
