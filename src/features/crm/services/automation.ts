import type { CrmService } from '@/features/crm/services/crm.service';
import type { CrmRepository, DealRow } from '@/features/crm/repositories/crm.repository';

/**
 * CRM automation — Milestone 10 (AD-5).
 *
 * Simple rule-based triggers evaluated against CRM events:
 *
 * - New deal in the first stage → auto-assign to a configured assignee.
 * - Deal value ≥ threshold → add a tag.
 * - Company created → add a default tag.
 *
 * Rules are org-scoped config. In M10 there is no workflow-builder table (that is
 * Milestone 25), so the ruleset is a typed, per-org configuration object with
 * sensible defaults. Evaluation is a pure function of (event, ruleset) — easy to
 * unit-test — and idempotent: the activity marker means re-running a rule cannot
 * double-apply.
 *
 * The `Deal` table has no assignee column (M4 schema); an assignment is an
 * `assigned` Activity on the deal, which doubles as the idempotency marker.
 *
 * The worker is DB-polled like the knowledge/reminder workers (no Redis until
 * M24). The processing steps are plain async functions so the integration test
 * drives the exact code path without faking timers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrmAutomationRules = {
  /** Auto-assign new deals in the first stage to this user id. */
  autoAssignNewDealTo: string | null;
  /** Tag deals whose value crosses this threshold. */
  highValueDealThreshold: number;
  highValueDealTagName: string;
  /** Tag newly created companies with this tag name. */
  companyDefaultTagName: string;
};

export const DEFAULT_RULES: CrmAutomationRules = {
  autoAssignNewDealTo: null,
  highValueDealThreshold: 10_000,
  highValueDealTagName: 'High value',
  companyDefaultTagName: 'Company',
};

export type CrmEvent =
  | { type: 'deal.created'; deal: DealRow }
  | { type: 'company.created'; companyId: string; companyName: string };

// ---------------------------------------------------------------------------
// Pure rule evaluation
// ---------------------------------------------------------------------------

export type RuleAction =
  | { kind: 'assign'; dealId: string; assigneeId: string }
  | { kind: 'tag'; taggableType: 'deal' | 'contact'; taggableId: string; tagName: string }
  | { kind: 'noop' };

/**
 * Evaluates an event against a ruleset. Pure: given the same inputs it always
 * returns the same actions, so the unit tests pin the rule logic without any
 * database.
 */
export function evaluateRules(event: CrmEvent, rules: CrmAutomationRules): RuleAction[] {
  const actions: RuleAction[] = [];

  if (event.type === 'deal.created') {
    if (rules.autoAssignNewDealTo) {
      actions.push({
        kind: 'assign',
        dealId: event.deal.id,
        assigneeId: rules.autoAssignNewDealTo,
      });
    }
    if (rules.highValueDealThreshold > 0 && event.deal.valueAmount >= rules.highValueDealThreshold) {
      actions.push({
        kind: 'tag',
        taggableType: 'deal',
        taggableId: event.deal.id,
        tagName: rules.highValueDealTagName,
      });
    }
  }

  if (event.type === 'company.created') {
    if (rules.companyDefaultTagName) {
      actions.push({
        kind: 'tag',
        taggableType: 'contact',
        taggableId: event.companyId,
        tagName: rules.companyDefaultTagName,
      });
    }
  }

  return actions.length > 0 ? actions : [{ kind: 'noop' }];
}

// ---------------------------------------------------------------------------
// Applying actions idempotently
// ---------------------------------------------------------------------------

/**
 * Applies an evaluated action. Each action is guarded by an activity marker so a
 * re-run (the worker is at-least-once) cannot apply twice.
 */
export async function applyAction(
  service: CrmService,
  repo: CrmRepository,
  action: RuleAction,
): Promise<void> {
  switch (action.kind) {
    case 'noop':
      return;
    case 'assign': {
      const already = await repo.hasActivityOfKind(action.dealId, 'deal', 'assigned');
      if (already) return;
      await service.recordActivity(action.dealId, 'deal', 'assigned', {
        body: 'Auto-assigned by automation rule',
        actor: null,
      });
      return;
    }
    case 'tag': {
      const tag = await repo.findOrCreateTagByName(action.tagName);
      const tagged = await repo.hasTag(tag.id, action.taggableType, action.taggableId);
      if (tagged) return;
      await repo.assignTag(tag.id, action.taggableType, action.taggableId);
      await service.recordActivity(action.taggableId, action.taggableType, 'label_changed', {
        body: `Auto-tagged "${action.tagName}" by automation rule`,
        actor: null,
      });
      return;
    }
  }
}

/** Options for the worker loop. */
export type RunAutomationOptions = {
  once?: boolean;
  pollIntervalMs?: number;
};
