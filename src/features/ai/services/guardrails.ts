import { ForbiddenError } from '@/lib/errors';

const MAX_REPLY_CHARACTERS = 1000;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu;
const URL_PATTERN = /https?:\/\/\S+/giu;
const PROMPT_LEAK_PATTERN =
  /\b(system prompt|developer message|hidden instructions)\b/giu;

const INJECTION_PATTERNS = [
  /ignore (all |the )?(previous|prior|system) instructions/iu,
  /reveal (the |your )?(system prompt|hidden instructions)/iu,
  /act as (the )?(system|developer|administrator)/iu,
  /override (the |your )?(rules|instructions|policy)/iu,
  /<\/?(?:system|developer|assistant)>/iu,
];

const HARD_ESCALATION_PATTERNS = [
  /\b(lawyer|legal action|sue|court)\b/iu,
  /\b(medical advice|diagnos(?:e|is)|prescription|emergency)\b/iu,
  /\b(payment dispute|chargeback|charged twice|unauthori[sz]ed charge)\b/iu,
  /\b(suicid(?:e|al)|self[- ]harm|in danger|threaten(?:ed|ing)?)\b/iu,
  /\b(human|real person|agent|manager|talk to someone)\b/iu,
];

export type TurnBudget = {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export const MAX_TURN_TOKENS = 8_000;
export const MAX_TURN_COST_USD = 0.1;

/** Conservative approximation used only as a hard ceiling, not provider billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateTurnBudget(input: string, output: string): TurnBudget {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  const estimatedCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  return { inputTokens, outputTokens, estimatedCost };
}

export function isOverTurnBudget(budget: TurnBudget): boolean {
  return (
    budget.inputTokens + budget.outputTokens > MAX_TURN_TOKENS ||
    budget.estimatedCost > MAX_TURN_COST_USD
  );
}

export function detectsPromptInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

export function requiresHardEscalation(message: string): boolean {
  return HARD_ESCALATION_PATTERNS.some((pattern) => pattern.test(message));
}

/** Removes content the AI is never allowed to send to a WhatsApp customer. */
export function sanitizeReply(reply: string): string {
  return reply
    .replace(UUID_PATTERN, '[reference removed]')
    .replace(URL_PATTERN, '[link removed]')
    .replace(PROMPT_LEAK_PATTERN, '[internal instructions removed]')
    .trim()
    .slice(0, MAX_REPLY_CHARACTERS);
}

export function assertToolAuthorized(
  toolName: string,
  allowedTools: ReadonlySet<string>,
) {
  if (!allowedTools.has(toolName)) {
    throw new ForbiddenError('The requested AI tool is not authorized.');
  }
}
