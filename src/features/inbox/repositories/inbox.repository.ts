import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { InboxConversationsRepository } from './conversations.repository';
import { InboxMessagesRepository } from './messages.repository';
import { InboxNotesRepository } from './notes.repository';
import { InboxLabelsRepository } from './labels.repository';
import { InboxSummaryRepository } from './summary.repository';

/**
 * Inbox data access facade — Milestone 6.
 *
 * The aggregate repositories (conversations, messages, notes, labels, summary)
 * each own one slice of the inbox database and stay under the 300-line
 * architecture rule. This facade composes them behind the single
 * `InboxRepository` surface the service, AI engine, and tests consume, so call
 * sites do not change and the tenant-isolation contract lives in
 * `InboxBaseRepository`.
 */

export class InboxRepository {
  readonly organizationId: string;
  readonly conversations: InboxConversationsRepository;
  readonly messages: InboxMessagesRepository;
  readonly notes: InboxNotesRepository;
  readonly labels: InboxLabelsRepository;
  readonly summary: InboxSummaryRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.conversations = new InboxConversationsRepository(scope);
    this.messages = new InboxMessagesRepository(scope);
    this.notes = new InboxNotesRepository(scope);
    this.labels = new InboxLabelsRepository(scope);
    this.summary = new InboxSummaryRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): InboxRepository {
    return new InboxRepository(resolveScope(organizationId));
  }

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  listConversations(
    filter?: Parameters<InboxConversationsRepository['listConversations']>[0],
  ): ReturnType<InboxConversationsRepository['listConversations']> {
    return this.conversations.listConversations(filter);
  }

  getConversation(
    conversationId: string,
  ): ReturnType<InboxConversationsRepository['getConversation']> {
    return this.conversations.getConversation(conversationId);
  }

  markRead(
    conversationId: string,
    userId: string,
  ): ReturnType<InboxConversationsRepository['markRead']> {
    return this.conversations.markRead(conversationId, userId);
  }

  setTyping(
    conversationId: string,
    userId: string,
    ttlSeconds?: number,
  ): ReturnType<InboxConversationsRepository['setTyping']> {
    return this.conversations.setTyping(conversationId, userId, ttlSeconds);
  }

  listTyping(
    conversationId: string,
  ): ReturnType<InboxConversationsRepository['listTyping']> {
    return this.conversations.listTyping(conversationId);
  }

  archiveConversation(
    conversationId: string,
    archive: boolean,
  ): ReturnType<InboxConversationsRepository['archiveConversation']> {
    return this.conversations.archiveConversation(conversationId, archive);
  }

  updateConversation(
    input: Parameters<InboxConversationsRepository['updateConversation']>[0],
  ): ReturnType<InboxConversationsRepository['updateConversation']> {
    return this.conversations.updateConversation(input);
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  listMessages(
    conversationId: string,
    before?: string,
    limit?: number,
  ): ReturnType<InboxMessagesRepository['listMessages']> {
    return this.messages.listMessages(conversationId, before, limit);
  }

  listAllMessages(
    conversationId: string,
  ): ReturnType<InboxMessagesRepository['listAllMessages']> {
    return this.messages.listAllMessages(conversationId);
  }

  sendMessage(
    input: Parameters<InboxMessagesRepository['sendMessage']>[0],
  ): ReturnType<InboxMessagesRepository['sendMessage']> {
    return this.messages.sendMessage(input);
  }

  attachToMessage(
    messageId: string,
    input: Parameters<InboxMessagesRepository['attachToMessage']>[1],
  ): ReturnType<InboxMessagesRepository['attachToMessage']> {
    return this.messages.attachToMessage(messageId, input);
  }

  search(q: string, limit?: number): ReturnType<InboxMessagesRepository['search']> {
    return this.messages.search(q, limit);
  }

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  listNotes(conversationId: string): ReturnType<InboxNotesRepository['listNotes']> {
    return this.notes.listNotes(conversationId);
  }

  createNote(
    conversationId: string,
    authorId: string,
    body: string,
  ): ReturnType<InboxNotesRepository['createNote']> {
    return this.notes.createNote(conversationId, authorId, body);
  }

  // -------------------------------------------------------------------------
  // Labels
  // -------------------------------------------------------------------------

  listLabels(): ReturnType<InboxLabelsRepository['listLabels']> {
    return this.labels.listLabels();
  }

  createLabel(
    name: string,
    color: string,
  ): ReturnType<InboxLabelsRepository['createLabel']> {
    return this.labels.createLabel(name, color);
  }

  addLabel(
    conversationId: string,
    labelId: string,
  ): ReturnType<InboxLabelsRepository['addLabel']> {
    return this.labels.addLabel(conversationId, labelId);
  }

  removeLabel(
    conversationId: string,
    labelId: string,
  ): ReturnType<InboxLabelsRepository['removeLabel']> {
    return this.labels.removeLabel(conversationId, labelId);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  getSummary(conversationId: string): ReturnType<InboxSummaryRepository['getSummary']> {
    return this.summary.getSummary(conversationId);
  }

  upsertSummary(
    conversationId: string,
    summary: string,
    model?: string,
  ): ReturnType<InboxSummaryRepository['upsertSummary']> {
    return this.summary.upsertSummary(conversationId, summary, model);
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  ConversationDetail,
  ConversationRow,
  InboxListFilter,
  LabelRow,
  MessageRow,
  NoteRow,
  SearchHit,
  SummaryRow,
  TypingRow,
} from './inbox.types';
