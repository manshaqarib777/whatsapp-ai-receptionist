import type { LLMProvider } from '@/lib/llm-gateway';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ATTEMPTS = 3;

export type ProviderExecutionOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
};

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('AI provider timed out.')), timeoutMs);
  });

  try {
    return await Promise.race([operation, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function draftReplyWithRetry(
  provider: LLMProvider,
  input: { context: string; instructions: string },
  options: ProviderExecutionOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const reply = await withTimeout(provider.draftReply(input), timeoutMs);
      if (reply.trim()) return reply;
      throw new Error('AI provider returned an empty reply.');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI provider failed.');
}
