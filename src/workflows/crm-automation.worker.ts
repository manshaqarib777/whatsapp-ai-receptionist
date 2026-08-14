import { logger } from '@/lib/logger';
import {
  DEFAULT_RULES,
  applyAction,
  evaluateRules,
  type CrmAutomationRules,
  type RunAutomationOptions,
} from '@/features/crm/services/automation';
import { CrmService } from '@/features/crm/services/crm.service';
import { CrmRepository } from '@/features/crm/repositories/crm.repository';

/**
 * CRM automation worker — Milestone 10 (AD-5).
 *
 * A DB-polled worker that evaluates rules against recent CRM events and applies
 * the resulting actions idempotently. No Redis, no external queue — the database
 * IS the queue (ARCHITECTURE_RULES §11, same pattern as the knowledge and
 * reminder workers).
 *
 * Because M10 has no event table, the "events" are the recent deal and company
 * rows themselves, evaluated against the idempotency markers: a deal that already
 * has an `assigned` activity is not assigned again, and a deal/company that
 * already has the rule's tag is not re-tagged.
 *
 * Run with `npm run crm:work`. Rules come from `DEFAULT_RULES` in M10 (org-scoped
 * config lands with the workflow builder in Milestone 25).
 */

const POLL_INTERVAL_MS = 30_000;
const LOOKBACK_MS = 7 * 86_400_000;

/** Processes all due events for every organization. Returns the action count. */
export async function processDueAutomation(rules: CrmAutomationRules = DEFAULT_RULES): Promise<number> {
  // Enumerating organizations is a pre-scope read (there is no tenant yet), the
  // same sanctioned pattern as the auth-context session resolution.
  const { prisma } = await import('@/lib/prisma');
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let applied = 0;

  for (const { id: organizationId } of organizations) {
    applied += await processOrganization(organizationId, rules);
  }

  return applied;
}

/** Evaluates and applies rules for one organization's recent events. */
export async function processOrganization(
  organizationId: string,
  rules: CrmAutomationRules = DEFAULT_RULES,
): Promise<number> {
  const repo = CrmRepository.forOrganization(organizationId);
  const service = CrmService.forOrganization(organizationId);
  const since = new Date(Date.now() - LOOKBACK_MS);

  let applied = 0;

  // Recent deals without an `assigned` marker (the assignment rule) and without
  // the high-value tag (the tag rule).
  const deals = await repo.listRecentDeals(since);
  for (const deal of deals) {
    const event = { type: 'deal.created' as const, deal };
    for (const action of evaluateRules(event, rules)) {
      if (action.kind === 'noop') continue;
      await applyAction(service, repo, action);
      applied += 1;
    }
  }

  // Recent companies without the default tag.
  const companies = await repo.listRecentCompanies(since);
  for (const company of companies) {
    const event = { type: 'company.created' as const, companyId: company.id, companyName: company.name };
    for (const action of evaluateRules(event, rules)) {
      if (action.kind === 'noop') continue;
      await applyAction(service, repo, action);
      applied += 1;
    }
  }

  return applied;
}

export async function runCrmAutomationWorker(options: RunAutomationOptions = {}): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  logger.info('crm automation worker started');

  for (;;) {
    try {
      const applied = await processDueAutomation();
      if (applied > 0) {
        logger.info({ applied }, 'crm automation rules applied');
      }
    } catch (error) {
      logger.error({ err: error }, 'crm automation worker cycle failed');
    }

    if (options.once) break;
    await sleep(pollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
