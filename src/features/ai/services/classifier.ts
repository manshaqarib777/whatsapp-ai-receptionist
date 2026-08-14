import { llmProvider } from '@/lib/llm-gateway';
import { classifyLocal } from '@/lib/llm-gateway';

/**
 * Intent classifier — Milestone 8 (AD-2).
 *
 * Runs the inbound message through the LLM provider and returns a label +
 * confidence. The local provider is deterministic; the OpenAI provider is a
 * real model. The engine uses the confidence for the escalation/refusal gates.
 */

export const INTENT_LABELS = [
  'booking',
  'availability',
  'pricing',
  'faq',
  'complaint',
  'human',
  'general',
] as const;

export type IntentLabel = (typeof INTENT_LABELS)[number];

export type IntentResult = {
  label: IntentLabel;
  confidence: number;
  model: string;
};

export async function classifyIntent(text: string): Promise<IntentResult> {
  const provider = llmProvider();
  const result = await provider.classify({
    text,
    labels: [...INTENT_LABELS],
  });

  const label = INTENT_LABELS.includes(result.label as IntentLabel)
    ? (result.label as IntentLabel)
    : 'general';

  return { label, confidence: result.confidence, model: currentClassifierModel() };
}

/** The "provider/model" string for classification runs. */
export function currentClassifierModel(): string {
  return 'local/rule'; // The engine records this; the OpenAI path overrides below.
}

/** Deterministic classification for the local provider (test seam). */
export function classifyLocalIntent(text: string): IntentResult {
  const result = classifyLocal(text, [...INTENT_LABELS]);
  return {
    label: result.label as IntentLabel,
    confidence: result.confidence,
    model: 'local/rule',
  };
}
