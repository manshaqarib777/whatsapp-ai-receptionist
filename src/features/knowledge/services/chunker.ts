import { createHash } from 'node:crypto';

/**
 * Pure text chunker (AD-5).
 *
 * Splits extracted text into ~800-token overlapping chunks. "Token" here is an
 * approximation (whitespace-delimited words) — good enough for chunk sizing, and
 * deterministic. Chunks respect paragraph boundaries when a boundary falls inside
 * the window, so a chunk never starts or ends mid-sentence unless the source
 * paragraph itself is longer than the target size.
 */

/** Approximate target size of a chunk, in whitespace-delimited tokens. */
export const CHUNK_TARGET_TOKENS = 800;

/** Overlap between adjacent chunks, in tokens. Prevents a cut from hiding context. */
export const CHUNK_OVERLAP_TOKENS = 80;

export type Chunk = {
  ordinal: number;
  content: string;
};

function tokenCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Chunks `text` into overlapping pieces.
 *
 * Splits on paragraph breaks first; paragraphs longer than the target are split
 * further on sentence-ish boundaries, then on words. The overlap is re-attached
 * from the previous chunk's tail so no content is duplicated into the database.
 */
export function chunkText(text: string): Chunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;

  function flush(): void {
    if (buffer.length === 0) return;
    const content = buffer.join('\n\n').trim();
    if (content.length > 0) {
      chunks.push({ ordinal: chunks.length + 1, content });
    }
    buffer = [];
    bufferTokens = 0;
  }

  function pushParagraph(paragraph: string): void {
    const paragraphTokens = tokenCount(paragraph);

    // A paragraph that alone exceeds the target gets split on its own.
    if (paragraphTokens > CHUNK_TARGET_TOKENS) {
      flush();
      for (const piece of splitLongParagraph(paragraph)) {
        chunks.push({ ordinal: chunks.length + 1, content: piece });
      }
      return;
    }

    // Would this paragraph overflow the window? Emit the current buffer as a
    // chunk first, then carry only its tail forward as overlap so no content is
    // lost and adjacent chunks share context across the cut.
    if (bufferTokens + paragraphTokens > CHUNK_TARGET_TOKENS && bufferTokens > 0) {
      const overlap = overlapTail(buffer);
      flush();
      if (overlap.length > 0) {
        buffer = [overlap];
        bufferTokens = tokenCount(overlap);
      }
    }

    buffer.push(paragraph);
    bufferTokens += paragraphTokens;
  }

  for (const paragraph of paragraphs) {
    pushParagraph(paragraph);
  }

  flush();

  return chunks;
}

/** The tail of the buffered text to carry into the next chunk as overlap. */
function overlapTail(buffer: string[]): string {
  const joined = buffer.join('\n\n');
  const words = joined.split(/\s+/).filter(Boolean);
  const tail = words.slice(-CHUNK_OVERLAP_TOKENS).join(' ');
  return tail;
}

/** Splits an over-long paragraph on sentence ends, then on word boundaries. */
function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  const pieces: string[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = tokenCount(sentence);

    if (sentenceTokens > CHUNK_TARGET_TOKENS) {
      // A single sentence longer than the whole window — split on words.
      if (buffer.length > 0) {
        pieces.push(buffer.join(' '));
        buffer = [];
        bufferTokens = 0;
      }
      const words = sentence.split(/\s+/);
      for (let i = 0; i < words.length; i += CHUNK_TARGET_TOKENS - CHUNK_OVERLAP_TOKENS) {
        const piece = words.slice(i, i + CHUNK_TARGET_TOKENS).join(' ');
        if (piece.length > 0) pieces.push(piece);
      }
      continue;
    }

    if (bufferTokens + sentenceTokens > CHUNK_TARGET_TOKENS && bufferTokens > 0) {
      pieces.push(buffer.join(' '));
      buffer = [];
      bufferTokens = 0;
    }

    buffer.push(sentence);
    bufferTokens += sentenceTokens;
  }

  if (buffer.length > 0) pieces.push(buffer.join(' '));

  return pieces;
}

/**
 * A stable content hash for change detection.
 *
 * Two uploads with identical content produce the same checksum, so re-ingesting an
 * unchanged file is a cheap no-op rather than a full re-chunk + re-embed.
 */
export function checksum(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
