import { z } from 'zod';

export const queueTranscriptionSchema = z
  .object({
    messageId: z.uuid(),
    attachmentId: z.uuid(),
    language: z.string().trim().min(2).max(20).default('auto'),
  })
  .strict();
export const speechSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    voice: z.enum(['alloy', 'coral', 'sage']).default('coral'),
  })
  .strict();
export const voiceCommandSchema = z
  .object({ transcript: z.string().trim().min(1).max(300) })
  .strict();
