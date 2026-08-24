import { AiRepository, type AiRunRow } from '@/features/ai/repositories/ai.repository';
import { classifyIntent, type IntentResult } from '@/features/ai/services/classifier';
import {
  buildMemoryContext,
  renderMemory,
  type MemoryTurn,
} from '@/features/ai/services/memory';
import { renderPrompt } from '@/features/ai/services/prompts';
import { describeTools } from '@/features/ai/services/tools/registry';
import {
  calculateTurnBudget,
  detectsPromptInjection,
  isOverTurnBudget,
  requiresHardEscalation,
  sanitizeReply,
} from '@/features/ai/services/guardrails';
import { draftReplyWithRetry } from '@/features/ai/services/provider-execution';
import {
  AiRunRecorder,
  type RecordedOutcome,
  type RunCitation,
} from '@/features/ai/services/ai-run-recorder';
import {
  engineTools,
  resolveAiToolContext,
} from '@/features/ai/services/ai-tool-context';
import { llmProvider, type LLMProvider } from '@/lib/llm-gateway';
import type { Scope } from '@/lib/db/scope';
import { InboxRepository } from '@/features/inbox/repositories/inbox.repository';
import { resolveScope } from '@/server/scope';
import { AiAgentsService } from '@/features/ai/services/agents.service';
import { agentProfile } from '@/features/ai/services/agent-catalog';

/**
 * AI Engine — Milestone 8 (AD-1, AD-3, AD-4).
 *
 * One guarded orchestration path serves every specialist. Local mode is deterministic
 * and capability selection is bounded by the server-owned agent catalog.
 */

export type EngineTurnInput = {
  conversationId: string;
  messageText: string;
  contactName?: string;
  runId?: string;
};

export type EngineTurnResult = {
  intent: IntentResult;
  reply: string;
  outcome: RecordedOutcome;
  citations: RunCitation[];
  runId: string;
  tokens: { input: number; output: number };
  latencyMs: number;
};

const CONFIDENCE_ESCALATION_THRESHOLD = 0.45;
const HOLDING_REPLY =
  'Thank you for your message — one of our team will get back to you shortly.';

export class AiEngineService {
  private readonly repo: AiRepository;
  private readonly inbox: InboxRepository;
  private readonly scope: Scope;
  private readonly provider: LLMProvider;
  private readonly recorder: AiRunRecorder;
  readonly organizationId: string;

  constructor(scope: Scope, provider: LLMProvider = llmProvider()) {
    this.scope = scope;
    this.organizationId = scope.organizationId;
    this.repo = new AiRepository(scope);
    this.inbox = new InboxRepository(scope);
    this.provider = provider;
    this.recorder = new AiRunRecorder(this.repo);
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
    const specialist = await AiAgentsService.forScope({
      organizationId: this.organizationId,
      branchId: conversation.branchId,
    }).resolve(input.messageText);

    if (conversation.assigneeId || conversation.isEscalated) {
      return this.persistGuardedTurn({
        conversation,
        reply: '',
        outcome: 'escalated',
        intent: { label: 'human', confidence: 1, model: 'local/guardrail' },
        startedAt,
        requestedRunId: input.runId,
        agentId: specialist?.id,
      });
    }

    if (
      detectsPromptInjection(input.messageText) ||
      requiresHardEscalation(input.messageText)
    ) {
      await this.escalateConversation(input.conversationId);
      return this.persistGuardedTurn({
        conversation,
        reply: HOLDING_REPLY,
        outcome: 'escalated',
        intent: { label: 'human', confidence: 1, model: 'local/guardrail' },
        startedAt,
        requestedRunId: input.runId,
        agentId: specialist?.id,
      });
    }

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
    const toolContext = await resolveAiToolContext(
      intent,
      input.messageText,
      this.scope,
      specialist ? new Set(specialist.tools) : undefined,
    );

    // 4. Render the prompt.
    const templateKey = templateKeyForIntent(intent.label);
    const promptBody =
      (await this.repo.resolveActiveBody(templateKey)) ?? defaultPrompt();
    const instructions = renderPrompt(promptBody, {
      customerName: input.contactName ?? conversation.contactDisplayName,
      conversationContext: memoryText,
      toolsDescription: describeTools(engineTools(specialist?.tools)),
    });
    const specialistInstructions = specialist
      ? `${instructions}\n\nSpecialist role: ${agentProfile(specialist.kind).purpose}`
      : instructions;

    // 5. Draft the reply.
    let reply = '';
    let providerFailed = false;
    try {
      reply = await draftReplyWithRetry(this.provider, {
        context: `${memoryText}\n\n${toolContext.text ? `Retrieved:\n${toolContext.text}` : ''}`,
        instructions: specialistInstructions,
      });
    } catch {
      providerFailed = true;
      reply = HOLDING_REPLY;
    }

    reply = sanitizeReply(reply);

    // 6. Hallucination guard + outcome.
    let outcome: EngineTurnResult['outcome'] = 'answered';
    if (providerFailed) {
      outcome = 'failed';
    } else if (toolContext.escalated) {
      outcome = 'escalated';
    } else if (
      !toolContext.text &&
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

    const budget = calculateTurnBudget(`${memoryText}\n${toolContext.text}`, reply);
    if (isOverTurnBudget(budget)) {
      outcome = 'escalated';
      reply = HOLDING_REPLY;
    }

    if (outcome === 'failed' || outcome === 'escalated') {
      await this.escalateConversation(input.conversationId);
    }

    // 7. Record the run.
    const latencyMs = Math.round(performance.now() - startedAt);
    const tokens = { input: budget.inputTokens, output: budget.outputTokens };
    const runId = await this.recorder.persist({
      branchId: conversation.branchId,
      conversationId: input.conversationId,
      intent,
      outcome,
      citations: toolContext.citations,
      latencyMs,
      tokens,
      requestedRunId: input.runId,
      agentId: specialist?.id,
    });

    return {
      intent,
      reply,
      outcome,
      citations: toolContext.citations,
      runId,
      tokens,
      latencyMs,
    };
  }

  private async persistGuardedTurn(input: {
    conversation: { id: string; branchId: string };
    reply: string;
    outcome: EngineTurnResult['outcome'];
    intent: IntentResult;
    startedAt: number;
    requestedRunId?: string;
    agentId?: string;
  }): Promise<EngineTurnResult> {
    const latencyMs = Math.round(performance.now() - input.startedAt);
    const budget = calculateTurnBudget('', input.reply);
    const tokens = { input: budget.inputTokens, output: budget.outputTokens };
    const runId = await this.recorder.persist({
      branchId: input.conversation.branchId,
      conversationId: input.conversation.id,
      intent: input.intent,
      outcome: input.outcome,
      citations: [],
      latencyMs,
      tokens,
      requestedRunId: input.requestedRunId,
      agentId: input.agentId,
    });
    return {
      intent: input.intent,
      reply: input.reply,
      outcome: input.outcome,
      citations: [],
      runId,
      tokens,
      latencyMs,
    };
  }

  private async escalateConversation(conversationId: string): Promise<void> {
    await this.inbox.updateConversation({ conversationId, isEscalated: true });
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
