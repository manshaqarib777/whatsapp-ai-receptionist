import { describe, expect, it } from 'vitest';

import {
  buildSummary,
  suggestActions,
  truncate,
} from '@/features/inbox/services/inbox.service';
import type { ConversationDetail } from '@/features/inbox/repositories/inbox.repository';

/**
 * Unit tests for the heuristic AI (AD-8) — pure functions, no database.
 */

const conversation = (overrides: Partial<ConversationDetail> = {}): ConversationDetail => ({
  id: 'conv-1',
  contactId: 'contact-1',
  contactDisplayName: 'Sara',
  contactLocale: 'en',
  contactPhone: '+966500000000',
  contactEmail: null,
  assigneeId: null,
  assigneeName: null,
  status: 'open',
  isPinned: false,
  isEscalated: false,
  unreadCount: 0,
  lastMessageAt: new Date(),
  branchId: 'branch-1',
  labels: [],
  ...overrides,
});

const message = (body: string, direction = 'inbound') => ({
  body,
  direction,
});

describe('suggestActions', () => {
  it('suggests escalation for an escalated conversation', () => {
    const suggestions = suggestActions(
      conversation({ isEscalated: true }),
      [message('hello')],
    );

    expect(suggestions.some((s) => s.kind === 'escalate')).toBe(true);
  });

  it('suggests a reply when there are unread messages', () => {
    const suggestions = suggestActions(
      conversation({ unreadCount: 2 }),
      [message('hello')],
    );

    expect(suggestions.some((s) => s.kind === 'reply')).toBe(true);
  });

  it('suggests resolving a quiet open conversation', () => {
    const suggestions = suggestActions(
      conversation({ status: 'open', unreadCount: 0 }),
      [message('thanks!')],
    );

    expect(suggestions.some((s) => s.kind === 'resolve')).toBe(true);
  });

  it('flags complaint keywords', () => {
    const suggestions = suggestActions(conversation(), [message('I am very unhappy with the service')]);

    expect(suggestions.some((s) => s.kind === 'follow-up')).toBe(true);
  });

  it('flags FAQ keywords', () => {
    const suggestions = suggestActions(conversation(), [message('What is the price?')]);

    expect(suggestions.some((s) => s.kind === 'faq')).toBe(true);
  });

  it('returns at most three suggestions', () => {
    const suggestions = suggestActions(
      conversation({ isEscalated: true, unreadCount: 1 }),
      [message('I am unhappy with the price, please refund')],
    );

    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe('buildSummary', () => {
  it('summarises a text conversation', () => {
    const summary = buildSummary(conversation(), [
      message('Hi, I need a cleaning'),
      message('Sure, when works?', 'outbound'),
      message('Thursday please'),
    ]);

    expect(summary).toContain('Sara');
    expect(summary).toContain('2 inbound');
    expect(summary).toContain('1 outbound');
  });

  it('handles a conversation with no inbound messages', () => {
    const summary = buildSummary(conversation(), [
      message('We can offer a discount', 'outbound'),
    ]);

    expect(summary).toContain('no inbound messages yet');
  });
});

describe('truncate', () => {
  it('truncates long text with an ellipsis', () => {
    expect(truncate('a'.repeat(100), 20)).toBe(`${'a'.repeat(19)}…`);
  });

  it('returns short text unchanged', () => {
    expect(truncate('short', 20)).toBe('short');
  });
});
