// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_TARGET_TOKENS,
  chunkText,
  checksum,
} from '@/features/knowledge/services/chunker';

/**
 * Chunker unit tests (AD-5).
 *
 * The chunker is the purest unit in the feature — no database, no I/O — so these
 * assert its contract directly: no chunk exceeds the target (except a single
 * over-long word), the overlap is bounded, paragraph boundaries are respected,
 * and the checksum is stable + sensitive.
 */

describe('chunkText', () => {
  it('returns [] for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('keeps a short document as a single chunk', () => {
    const chunks = chunkText('One short paragraph.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('One short paragraph.');
    expect(chunks[0]?.ordinal).toBe(1);
  });

  it('respects paragraph boundaries — does not split a short paragraph mid-sentence', () => {
    const p1 = 'First paragraph.'.repeat(1);
    const p2 = 'Second paragraph with a few more words to make it distinct.';
    const chunks = chunkText(`${p1}\n\n${p2}`);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('First paragraph');
    expect(chunks[0]?.content).toContain('Second paragraph');
  });

  it('splits a long document into multiple chunks with bounded size', () => {
    // ~60 words per paragraph, 30 paragraphs → well over the 800-token target.
    const paragraphs = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i}: ` + 'word '.repeat(60).trim(),
    );
    const text = paragraphs.join('\n\n');
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const tokens = chunk.content.split(/\s+/).length;
      // Allow one over-long sentence; the window itself is bounded at target+overlap.
      expect(tokens).toBeLessThanOrEqual(CHUNK_TARGET_TOKENS + CHUNK_OVERLAP_TOKENS + 2);
      expect(chunk.ordinal).toBeGreaterThan(0);
    }
  });

  it('numbers ordinals sequentially starting at 1', () => {
    const text = Array.from(
      { length: 5 },
      (_, i) => `word `.repeat(400).trim() + ` ${i}`,
    ).join('\n\n');
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i + 1));
  });

  it('handles a single paragraph longer than the window', () => {
    const longParagraph = 'word '.repeat(2000).trim();
    const chunks = chunkText(longParagraph);
    expect(chunks.length).toBeGreaterThan(1);
    // Reassembling the pieces (minus overlap) preserves all words.
    const words = chunks
      .map((c) => c.content.split(/\s+/).length)
      .reduce((a, b) => a + b, 0);
    expect(words).toBeGreaterThanOrEqual(2000);
  });

  it('is deterministic — same input, same chunks', () => {
    const text = 'Deterministic input. '.repeat(100);
    expect(chunkText(text)).toEqual(chunkText(text));
  });
});

describe('checksum', () => {
  it('is stable across calls', () => {
    expect(checksum('hello world')).toBe(checksum('hello world'));
  });

  it('changes when the content changes', () => {
    expect(checksum('hello world')).not.toBe(checksum('hello world!'));
  });
});
