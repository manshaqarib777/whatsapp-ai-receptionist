import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RULES,
  evaluateRules,
  type CrmAutomationRules,
} from '@/features/crm/services/automation';
import type { DealRow } from '@/features/crm/repositories/crm.repository';

/**
 * Automation rule evaluation unit tests (M10, AD-5).
 *
 * `evaluateRules` is pure, so these pin the rule logic without any database.
 */

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'deal-1',
    contactId: null,
    companyId: null,
    stageId: 'stage-1',
    stageName: 'New enquiry',
    title: 'Test deal',
    valueAmount: 5_000,
    valueCurrency: 'SAR',
    status: 'open',
    closedAt: null,
    createdAt: new Date('2026-08-14T09:00:00.000Z'),
    updatedAt: new Date('2026-08-14T09:00:00.000Z'),
    version: 1,
    contactName: null,
    companyName: null,
    tags: [],
    ...overrides,
  };
}

describe('evaluateRules — deal.created', () => {
  it('assigns a new deal when a rule is configured', () => {
    const rules: CrmAutomationRules = { ...DEFAULT_RULES, autoAssignNewDealTo: 'user-1' };
    const actions = evaluateRules({ type: 'deal.created', deal: makeDeal() }, rules);

    expect(actions).toContainEqual({
      kind: 'assign',
      dealId: 'deal-1',
      assigneeId: 'user-1',
    });
  });

  it('does not assign when no assignee is configured', () => {
    const actions = evaluateRules(
      { type: 'deal.created', deal: makeDeal() },
      { ...DEFAULT_RULES, autoAssignNewDealTo: null },
    );

    expect(actions.some((a) => a.kind === 'assign')).toBe(false);
  });

  it('tags a deal above the high-value threshold', () => {
    const rules: CrmAutomationRules = {
      ...DEFAULT_RULES,
      highValueDealThreshold: 10_000,
    };
    const deal = makeDeal({ valueAmount: 12_000 });

    const actions = evaluateRules({ type: 'deal.created', deal }, rules);

    expect(actions).toContainEqual({
      kind: 'tag',
      taggableType: 'deal',
      taggableId: 'deal-1',
      tagName: 'High value',
    });
  });

  it('does not tag a deal below the threshold', () => {
    const actions = evaluateRules(
      { type: 'deal.created', deal: makeDeal({ valueAmount: 500 }) },
      DEFAULT_RULES,
    );

    expect(actions.some((a) => a.kind === 'tag')).toBe(false);
  });

  it('returns a noop when nothing applies', () => {
    const actions = evaluateRules(
      { type: 'deal.created', deal: makeDeal({ valueAmount: 100 }) },
      { ...DEFAULT_RULES, autoAssignNewDealTo: null, highValueDealThreshold: 0 },
    );

    expect(actions).toEqual([{ kind: 'noop' }]);
  });
});

describe('evaluateRules — company.created', () => {
  it('tags a new company with the default tag', () => {
    const actions = evaluateRules(
      { type: 'company.created', companyId: 'company-1', companyName: 'Acme' },
      DEFAULT_RULES,
    );

    expect(actions).toContainEqual({
      kind: 'tag',
      taggableType: 'contact',
      taggableId: 'company-1',
      tagName: 'Company',
    });
  });

  it('noops when the default tag name is empty', () => {
    const actions = evaluateRules(
      { type: 'company.created', companyId: 'company-1', companyName: 'Acme' },
      { ...DEFAULT_RULES, companyDefaultTagName: '' },
    );

    expect(actions).toEqual([{ kind: 'noop' }]);
  });
});

describe('evaluateRules — idempotency is the caller concern', () => {
  it('evaluates deterministically: same input, same actions', () => {
    const deal = makeDeal({ valueAmount: 25_000 });
    const rules: CrmAutomationRules = { ...DEFAULT_RULES, autoAssignNewDealTo: 'user-1' };

    const first = evaluateRules({ type: 'deal.created', deal }, rules);
    const second = evaluateRules({ type: 'deal.created', deal }, rules);

    expect(first).toEqual(second);
  });
});
