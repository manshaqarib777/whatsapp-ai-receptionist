import {
  InboxRepository,
  type ConversationDetail,
  type ConversationRow,
  type InboxListFilter,
  type MessageRow,
  type NoteRow,
  type SearchHit,
} from '@/features/inbox/repositories/inbox.repository';

/**
 * Inbox view model — pure orchestration over the repository.
 *
 * No database access here. The repository returns raw rows; this service composes
 * them into the shape the UI renders and owns the presentation decisions that are
 * unit-testable without a database: heuristic AI suggestions, conversation
 * summaries, and message list ordering for display.
 *
 * The heuristic AI (AD-8) is deliberately rule-based — no LLM calls. Milestone 8
 * swaps the same UI seam for the real AI Engine.
 */

// ---------------------------------------------------------------------------
// Heuristic AI suggestions
// ---------------------------------------------------------------------------

export type SuggestionKind =
  | 'escalate'
  | 'resolve'
  | 'reply'
  | 'follow-up'
  | 'label'
  | 'faq';

export type Suggestion = {
  kind: SuggestionKind;
  title: string;
  description: string;
  /** The quick action the suggestion offers (rendered as a chip). */
  action: string;
};

const FAQ_KEYWORDS = ['price', 'pricing', 'cost', 'open', 'hours', 'location', 'appointment'];
const COMPLAINT_KEYWORDS = ['complaint', 'refund', 'unhappy', 'angry', 'wrong', 'terrible'];

/**
 * Rule-based suggestions for a conversation. Pure and unit-testable. Returns at
 * most 3, ranked by severity.
 */
export function suggestActions(
  conversation: Pick<ConversationDetail, 'isEscalated' | 'status' | 'unreadCount'>,
  messages: Pick<MessageRow, 'body' | 'direction'>[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
  const body = lastInbound?.body?.toLowerCase() ?? '';

  if (conversation.isEscalated) {
    suggestions.push({
      kind: 'escalate',
      title: 'Escalated conversation',
      description: 'This thread is escalated. Keep responses concise and empathetic.',
      action: 'View escalation',
    });
  }

  if (COMPLAINT_KEYWORDS.some((k) => body.includes(k))) {
    suggestions.push({
      kind: 'follow-up',
      title: 'Possible complaint',
      description: 'The last message mentions dissatisfaction. Offer a clear resolution path.',
      action: 'Draft empathetic reply',
    });
  }

  const faqHit = FAQ_KEYWORDS.find((k) => body.includes(k));
  if (faqHit) {
    suggestions.push({
      kind: 'faq',
      title: `Question about "${faqHit}"`,
      description: 'A quick, factual answer is likely enough here.',
      action: 'Answer from knowledge base',
    });
  }

  if (conversation.unreadCount > 0 && !conversation.isEscalated) {
    suggestions.push({
      kind: 'reply',
      title: 'Unread inbound message',
      description: 'The contact is waiting on a reply.',
      action: 'Reply now',
    });
  }

  if (conversation.status === 'open' && conversation.unreadCount === 0) {
    suggestions.push({
      kind: 'resolve',
      title: 'Conversation seems resolved',
      description: 'No unread messages; consider closing the thread.',
      action: 'Mark resolved',
    });
  }

  return suggestions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Heuristic conversation summary
// ---------------------------------------------------------------------------

/**
 * Builds a plain-language summary from message content + contact context. No LLM.
 * Truncates long threads; the M8 engine replaces this with a real generation.
 */
export function buildSummary(
  conversation: Pick<ConversationDetail, 'contactDisplayName' | 'contactLocale'>,
  messages: Pick<MessageRow, 'direction' | 'body' | 'contentType'>[],
): string {
  const inbound = messages.filter((m) => m.direction === 'inbound');
  const outbound = messages.filter((m) => m.direction === 'outbound');
  const textInbound = inbound.filter((m) => m.contentType === 'text' && m.body);

  const contact = conversation.contactDisplayName;
  if (inbound.length === 0) {
    return `Conversation with ${contact} — no inbound messages yet.`;
  }

  const firstInbound = textInbound[0]?.body ?? 'an inbound message';
  const lastInbound = textInbound[textInbound.length - 1]?.body ?? firstInbound;
  const truncatedFirst = truncate(firstInbound, 90);
  const truncatedLast = truncate(lastInbound, 90);

  return [
    `${contact} started with "${truncatedFirst}".`,
    `${inbound.length} inbound and ${outbound.length} outbound messages so far.`,
    `Last message: "${truncatedLast}".`,
  ].join(' ');
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InboxService {
  private readonly repo: InboxRepository;

  constructor(repo: InboxRepository) {
    this.repo = repo;
  }

  static forOrganization(organizationId: string): InboxService {
    return new InboxService(InboxRepository.forOrganization(organizationId));
  }

  async listConversations(filter: InboxListFilter) {
    return this.repo.listConversations(filter);
  }

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    return this.repo.getConversation(conversationId);
  }

  async getThread(conversationId: string) {
    const [conversation, messages, notes, summary, typing] = await Promise.all([
      this.repo.getConversation(conversationId),
      this.repo.listAllMessages(conversationId),
      this.repo.listNotes(conversationId),
      this.repo.getSummary(conversationId),
      this.repo.listTyping(conversationId),
    ]);

    const suggestions = suggestActions(conversation, messages);
    const heuristicSummary = summary?.summary ?? buildSummary(conversation, messages);

    return {
      conversation,
      messages,
      notes,
      summary: {
        summary: heuristicSummary,
        model: summary?.model ?? 'heuristic',
        version: summary?.version ?? 1,
        status: summary?.status ?? 'current',
        updatedAt: summary?.updatedAt ?? new Date(),
      },
      suggestions,
      typing,
    };
  }

  async listMessages(conversationId: string, before?: string) {
    return this.repo.listMessages(conversationId, before);
  }

  async listNotes(conversationId: string): Promise<NoteRow[]> {
    return this.repo.listNotes(conversationId);
  }

  async search(q: string): Promise<SearchHit[]> {
    return this.repo.search(q);
  }

  async sendMessage(input: { conversationId: string; authorId: string; body: string }) {
    return this.repo.sendMessage(input);
  }

  async createNote(conversationId: string, authorId: string, body: string) {
    return this.repo.createNote(conversationId, authorId, body);
  }
}
