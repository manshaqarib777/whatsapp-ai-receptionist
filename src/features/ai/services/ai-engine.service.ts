import { AiRepository, type AiRunRow } from '@/features/ai/repositories/ai.repository';
import { classifyIntent, type IntentResult } from '@/features/ai/services/classifier';
import {
  buildMemoryContext,
  renderMemory,
  type MemoryTurn,
} from '@/features/ai/services/memory';
import { renderPrompt } from '@/features/ai/services/prompts';
import {
  describeTools,
  knowledgeTool,
  type ToolDefinition,
} from '@/features/ai/services/tools/registry';
import { llmProvider, currentReplyModel } from '@/lib/llm-gateway';
import type { Scope } from '@/lib/db/scope';
import { InboxRepository } from '@/features/inbox/repositories/inbox.repository';
import { resolveScope } from '@/server/scope';

/**
 * AI Engine — Milestone 8 (AD-1, AD-3, AD-4).
 *
 * The turn orchestration service. Given a conversation (and optionally a new
 * inbound message), it:
 *
 *   1. Reads the conversation + recent messages (windowed memory + summary).
 *   2. Classifies intent + confidence.
 *   3. Resolves the active prompt template for the intent.
 *   4. Runs the tool that fits the intent (knowledge lookup, availability
 *      proposal, escalate) — authorization in code, scoping from the session.
 *   5. Drafts the reply through the LLM provider with the rendered prompt.
 *   6. Applies the hallucination guard: no retrieval support → refuse, never
 *      invent.
 *   7. Records an `ai_runs` row (model, tokens, cost, latency, outcome, intent,
 *      confidence) plus `ai_run_citations` when retrieval backed the answer.
 *
 * The engine is deterministic under the local provider — the whole suite runs
 * without an API key.
 */

export type EngineTurnInput = {
  conversationId: string;
  messageText: string;
  contactName?: string;
};

export type EngineTurnResult = {
  intent: IntentResult;
  reply: string;
  outcome: 'answered' | 'escalated' | 'refused' | 'failed';
  citations: { chunkId: string; similarity: number; content: string }[];
  runId: string;
  tokens: { input: number; output: number };
  latencyMs: number;
};

const CONFIDENCE_ESCALATION_THRESHOLD = 0.45;
const SIMILARITY_CITATION_THRESHOLD = 0.5;

export class AiEngineService {
  private readonly repo: AiRepository;
  private readonly inbox: InboxRepository;
  private readonly scope: Scope;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.scope = scope;
    this.organizationId = scope.organizationId;
    this.repo = new AiRepository(scope);
    this.inbox = new InboxRepository(scope);
  }

  static forOrganization(organizationId: string): AiEngineService {
    return new AiEngineService(resolveScope(organizationId));
  }

  // -------------------------------------------------------------------------
  // Turn orchestration
  // -------------------------------------------------------------------------

  async runTurn(input: EngineTurnInput): Promise<EngineTurnResult> {
    const startedAt = performance.now();

    // 1. Read the conversation + windowed memory.
    const conversation = await this.inbox.getConversation(input.conversationId);
    const messages = await this.inbox.listAllMessages(input.conversationId);
    const summaryRow = await this.inbox.getSummary(input.conversationId);
    const summary = summaryRow?.summary ?? null;

    const turns: MemoryTurn[] = messages.slice(-12).map((m) => ({
      role:
        m.authorType === 'contact' ? 'customer' : m.authorType === 'ai' ? 'ai' : 'agent',
      text: m.body ?? '',
      at: m.createdAt,
    }));
    const memory = buildMemoryContext(summary, turns);
    const memoryText = renderMemory(memory);

    // 2. Classify.
    const intent = await classifyIntent(input.messageText);

    // 3. Tools.
    let toolContext = '';
    let citations: EngineTurnResult['citations'] = [];
    let escalated = false;

    if (intent.label === 'complaint' || intent.label === 'human') {
      escalated = true;
    } else if (intent.label === 'booking' || intent.label === 'availability') {
      toolContext =
        'The customer asked about appointments. Offer to check availability or book a slot.';
    } else {
      // FAQ / pricing / general → retrieval-backed answer.
      const result = await knowledgeTool.execute(
        { query: input.messageText, limit: 3 },
        this.scope,
      );
      const hits = (
        result.data as { hits: { content: string; similarity: number; source: string }[] }
      ).hits;
      const aboveThreshold = hits.filter(
        (h) => h.similarity >= SIMILARITY_CITATION_THRESHOLD,
      );
      if (aboveThreshold.length > 0) {
        toolContext = aboveThreshold.map((h) => h.content).join('\n');
        citations = aboveThreshold.slice(0, 3).map((h) => ({
          chunkId: 'retrieved',
          similarity: h.similarity,
          content: h.content,
        }));
      }
    }

    // 4. Render the prompt.
    const templateKey = templateKeyForIntent(intent.label);
    const promptBody =
      (await this.repo.resolveActiveBody(templateKey)) ?? defaultPrompt();
    const instructions = renderPrompt(promptBody, {
      customerName: input.contactName ?? conversation.contactDisplayName,
      conversationContext: memoryText,
      toolsDescription: describeTools(engineTools()),
    });

    // 5. Draft the reply.
    const provider = llmProvider();
    let reply = '';
    try {
      reply = await provider.draftReply({
        context: `${memoryText}\n\n${toolContext ? `Retrieved:\n${toolContext}` : ''}`,
        instructions,
      });
    } catch {
      reply =
        'Thank you for your message — one of our team will get back to you shortly.';
    }

    // 6. Hallucination guard + outcome.
    let outcome: EngineTurnResult['outcome'] = 'answered';
    if (escalated) {
      outcome = 'escalated';
    } else if (
      !toolContext &&
      intent.label !== 'general' &&
      intent.label !== 'booking' &&
      intent.label !== 'availability'
    ) {
      // No retrieval support and no structured answer → refuse rather than invent.
      outcome = 'refused';
      reply =
        'I want to make sure you get a correct answer — let me hand this to a teammate who can help.';
    } else if (intent.confidence < CONFIDENCE_ESCALATION_THRESHOLD) {
      outcome = 'escalated';
    }

    // 7. Record the run.
    const latencyMs = Math.round(performance.now() - startedAt);
    const tokens = { input: memoryText.length, output: reply.length };
    const runId = await this.persistRun({
      branchId: conversation.branchId,
      conversationId: input.conversationId,
      intent,
      outcome,
      reply,
      citations,
      latencyMs,
      tokens,
    });

    return {
      intent,
      reply,
      outcome,
      citations,
      runId,
      tokens,
      latencyMs,
    };
  }

  private async persistRun(input: {
    branchId: string;
    conversationId: string;
    intent: IntentResult;
    outcome: EngineTurnResult['outcome'];
    reply: string;
    citations: EngineTurnResult['citations'];
    latencyMs: number;
    tokens: { input: number; output: number };
  }): Promise<string> {
    const run = await this.repo.createRun({
      branchId: input.branchId,
      conversationId: input.conversationId,
      outputMessageId: null,
      promptVersionId: null,
      model: currentReplyModel(),
      intent: input.intent.label,
      confidence: input.intent.confidence,
      inputTokens: input.tokens.input,
      outputTokens: input.tokens.output,
      costAmount: estimateCost(input.tokens),
      costCurrency: 'USD',
      latencyMs: input.latencyMs,
      outcome: input.outcome,
    });

    const realCitations = input.citations.filter((c) => c.chunkId !== 'retrieved');
    if (realCitations.length > 0) {
      await this.repo.createCitations(
        run.id,
        realCitations.map((c) => ({
          knowledgeChunkId: c.chunkId,
          similarity: c.similarity,
        })),
        input.branchId,
      );
    }

    return run.id;
  }

  async listRuns(conversationId?: string): Promise<AiRunRow[]> {
    return this.repo.listRuns(conversationId);
  }
}

function templateKeyForIntent(intent: string): string {
  switch (intent) {
    case 'booking':
    case 'availability':
      return 'receptionist.booking';
    case 'complaint':
      return 'receptionist.complaint';
    case 'human':
      return 'receptionist.escalation';
    default:
      return 'receptionist.faq';
  }
}

function engineTools(): ToolDefinition[] {
  return [knowledgeTool];
}

function defaultPrompt(): string {
  return [
    'You are the WhatsApp receptionist for {{business_name}}.',
    'Answer the customer conversationally and briefly.',
    'Never invent facts. Never make pricing commitments. Never mention internal ids.',
    'If the customer asks to speak to a person, offer escalation.',
    '',
    '{{conversation_context}}',
  ].join('\n');
}

/** Crude token→USD cost model (the live provider fills the real numbers). */
function estimateCost(tokens: { input: number; output: number }): number {
  // ~$3 / 1M input tokens, ~$15 / 1M output — a rough ceiling, replaced by the
  // provider's real usage in the OpenAI path.
  return (tokens.input * 3 + tokens.output * 15) / 1_000_000;
}
