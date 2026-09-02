import { z } from 'zod';

/**
 * Inbox request validation. Every inbox mutation route parses its body with these
 * schemas; `withApiHandler` converts a thrown ZodError into a 400 with per-field
 * details.
 */

export const conversationStatusSchema = z.enum([
  'open',
  'pending',
  'resolved',
  'archived',
]);

export const inboxListQuerySchema = z.object({
  status: conversationStatusSchema.optional(),
  assignee: z.enum(['me', 'unassigned']).optional(),
  labelId: z.string().uuid().optional(),
  pinned: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
  contentType: z
    .enum(['text', 'image', 'audio', 'video', 'document', 'location', 'sticker'])
    .optional(),
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty.').max(4000),
});

export const archiveSchema = z.object({
  archive: z.boolean(),
});

export const updateConversationSchema = z.object({
  assigneeId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
});

export const addLabelSchema = z.object({
  labelId: z.string().uuid(),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required.').max(50),
  color: z
    .enum(['neutral', 'info', 'success', 'warning', 'destructive'])
    .default('neutral'),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const messagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
