import { describe, expect, it } from 'vitest';

import { classifyLocal } from '@/lib/llm-gateway';
import { classifyLocalIntent, INTENT_LABELS } from '@/features/ai/services/classifier';
import {
  buildMemoryContext,
  renderMemory,
  MEMORY_WINDOW_TURNS,
} from '@/features/ai/services/memory';
import { renderPrompt } from '@/features/ai/services/prompts';
import { runTurnSchema } from '@/features/ai/validators/ai.validators';

/**
 * AI Engine unit tests — the deterministic local provider, memory windowing,
 * and prompt rendering (no database, no network).
 */

describe('classifier (local provider)', () => {
  it('detects booking intent from keywords', () => {
    const result = classifyLocal('Can I book an appointment for Saturday?', [
      ...INTENT_LABELS,
    ]);
    expect(result.label).toBe('booking');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('detects pricing intent', () => {
    const result = classifyLocal('How much does a check-up cost?', [...INTENT_LABELS]);
    expect(result.label).toBe('pricing');
  });

  it('detects a human handover request', () => {
    const result = classifyLocal('I want to talk to a real person', [...INTENT_LABELS]);
    expect(result.label).toBe('human');
  });

  it('returns general with low confidence for unknown text', () => {
    const result = classifyLocal('haha ok', [...INTENT_LABELS]);
    expect(result.label).toBe('general');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('is deterministic — same input, same output', () => {
    const text = 'I need to book a slot next week';
    expect(classifyLocal(text, [...INTENT_LABELS])).toEqual(
      classifyLocal(text, [...INTENT_LABELS]),
    );
  });
});

describe('AI request validation', () => {
  it('rejects unknown fields at the API boundary', () => {
    expect(() =>
      runTurnSchema.parse({
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'Hello',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      }),
    ).toThrow();
  });
});

describe('memory (AD-5)', () => {
  it('windows the recent turns and keeps the summary', () => {
    const turns = Array.from({ length: 20 }, (_, i) => ({
      role: 'customer' as const,
      text: `turn ${i}`,
      at: new Date(),
    }));
    const context = buildMemoryContext('prior summary', turns);
    expect(context.recentTurns.length).toBeLessThanOrEqual(MEMORY_WINDOW_TURNS);
    expect(context.recentTurns[0]?.text).toBe(`turn ${20 - MEMORY_WINDOW_TURNS}`);
    expect(context.summary).toBe('prior summary');
  });

  it('renders the context into the prompt form', () => {
    const context = buildMemoryContext('Prior: wants a booking', [
      { role: 'customer', text: 'Do you have slots?', at: new Date() },
      { role: 'ai', text: 'Checking…', at: new Date() },
    ]);
    const rendered = renderMemory(context);
    expect(rendered).toContain('Prior: wants a booking');
    expect(rendered).toContain('Customer: Do you have slots?');
    expect(rendered).toContain('Assistant: Checking…');
  });
});

describe('prompts (AD-6)', () => {
  it('renders template placeholders with the runtime context', () => {
    const body =
      'You are the receptionist for {{business_name}}.\n{{conversation_context}}';
    const rendered = renderPrompt(body, {
      businessName: 'Northwind Dental',
      conversationContext: 'Customer asked about hours',
      toolsDescription: '',
    });
    expect(rendered).toContain('Northwind Dental');
    expect(rendered).toContain('Customer asked about hours');
  });

  it('classifyLocalIntent exposes the local seam', () => {
    const result = classifyLocalIntent('I have a complaint about my bill');
    expect(result.label).toBe('complaint');
    expect(result.model).toBe('local/rule');
  });
});
