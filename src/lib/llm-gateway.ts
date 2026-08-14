import { env } from '@/lib/env';

/**
 * LLM provider seam — Milestone 8 (AD-2). The AI Engine's language-model half.
 *
 * `AI_ENGINE_RULES.md` addresses models as `"provider/model"` strings and forbids
 * hardcoding a provider SDK. This module is the seam: classification,
 * summarisation, and reply drafting all go through the `LLMProvider` interface,
 * and every `ai_runs` row records the model string.
 *
 * - `local` (default) — deterministic rule-based provider. No key, unit-testable,
 *   used by the test suite and seed. Semantically shallow by design; real replies
 *   need the live provider.
 * - `openai` — chat completions via the OpenAI SDK when `OPENAI_API_KEY` is set
 *   and `LLM_PROVIDER=openai`.
 */

export type Classification = {
  label: string;
  confidence: number;
};

export interface LLMProvider {
  classify(input: { text: string; labels: string[] }): Promise<Classification>;
  summarize(input: { turns: string[] }): Promise<string>;
  draftReply(input: { context: string; instructions: string }): Promise<string>;
}

/** The `"provider/model"` string the current provider records on runs. */
export function currentReplyModel(): string {
  return env.LLM_PROVIDER === 'openai' ? `openai/${env.LLM_REPLY_MODEL}` : 'local/rule';
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

class OpenAILLMProvider implements LLMProvider {
  async classify(input: { text: string; labels: string[] }): Promise<Classification> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: env.LLM_CLASSIFY_MODEL,
      messages: [
        {
          role: 'system',
          content: `Classify the customer message into exactly one of: ${input.labels.join(', ')}. Respond with only the label and a confidence 0..1 as JSON.`,
        },
        { role: 'user', content: input.text },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(raw) as { label?: string; confidence?: number };
      return {
        label: parsed.label ?? input.labels[0] ?? 'unknown',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch {
      return { label: input.labels[0] ?? 'unknown', confidence: 0.5 };
    }
  }

  async summarize(input: { turns: string[] }): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: env.LLM_CLASSIFY_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Summarise this conversation in 2-3 plain sentences. Focus on the customer request and any commitments made. No PII beyond the customer name if stated.',
        },
        { role: 'user', content: input.turns.join('\n') },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? '';
  }

  async draftReply(input: { context: string; instructions: string }): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: env.LLM_REPLY_MODEL,
      messages: [
        {
          role: 'system',
          content: `${input.instructions}\n\nKeep replies short, plain, and suitable for WhatsApp. Never mention internal ids, never invent facts not in the context, never make pricing promises.`,
        },
        { role: 'user', content: input.context },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}

// ---------------------------------------------------------------------------
// Local deterministic provider
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<string, string[]> = {
  booking: ['book', 'appointment', 'schedule', 'slot', 'reserve', 'booking'],
  availability: ['available', 'free', 'when', 'time', 'open'],
  pricing: ['price', 'cost', 'how much', 'fee', 'charge'],
  faq: ['hours', 'location', 'address', 'parking', 'insurance'],
  complaint: ['complaint', 'refund', 'unhappy', 'angry', 'wrong', 'terrible'],
  human: ['human', 'person', 'agent', 'manager', 'talk to someone'],
};

/** Deterministic rule classifier — same input always yields the same label. */
export function classifyLocal(text: string, labels: string[]): Classification {
  const lower = text.toLowerCase();
  const scores = labels.map((label) => {
    const keywords = INTENT_KEYWORDS[label] ?? [];
    const hits = keywords.filter((k) => lower.includes(k)).length;
    return hits;
  });

  const best = Math.max(...scores);
  const bestIndex = scores.indexOf(best);
  if (best === 0) return { label: 'general', confidence: 0.4 };

  // Normalise to a 0.55..0.98 confidence from the raw hit count.
  const confidence = Math.min(0.98, 0.55 + best * 0.15);
  return { label: labels[bestIndex] ?? 'general', confidence };
}

class LocalLLMProvider implements LLMProvider {
  async classify(input: { text: string; labels: string[] }): Promise<Classification> {
    return classifyLocal(input.text, input.labels);
  }

  async summarize(input: { turns: string[] }): Promise<string> {
    const tail = input.turns.slice(-6);
    if (tail.length === 0) return '';
    const last = tail[tail.length - 1] ?? '';
    const excerpt = last.length > 160 ? `${last.slice(0, 160)}…` : last;
    return `Customer requested: ${excerpt}`;
  }

  async draftReply(input: { context: string; instructions: string }): Promise<string> {
    // A deliberately conservative local reply: quote the instructions and the
    // retrieval-backed context without inventing anything. The live provider
    // produces the real WhatsApp copy.
    const context = input.context.trim();
    if (!context) {
      return 'Thank you for your message — one of our team will get back to you shortly.';
    }
    const firstLine = context.split('\n')[0]?.trim() ?? '';
    if (firstLine.length === 0) {
      return 'Thank you for your message — one of our team will get back to you shortly.';
    }
    return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function llmProvider(): LLMProvider {
  if (env.LLM_PROVIDER === 'openai') {
    return new OpenAILLMProvider();
  }
  return new LocalLLMProvider();
}
