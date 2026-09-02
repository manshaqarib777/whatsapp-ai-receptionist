import { ConflictError, NotFoundError, UnprocessableError } from '@/lib/errors';

import { LoyaltyRepository } from '@/features/loyalty/repositories/loyalty.repository';
import type { LoyaltyAccountRow } from '@/features/loyalty/repositories/loyalty.types';

/**
 * Loyalty orchestration — Milestone 17.
 *
 * Points math (floor(total × rate)), tier derivation (bronze/silver/gold),
 * redemption guards, coupon rules, and the referral bonus. The earn worker
 * steps are public methods so the integration test drives them directly.
 */

export const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 2000 } as const;
export const DEFAULT_REFERRAL_BONUS = 100;

export function tierFor(totalEarned: number): 'bronze' | 'silver' | 'gold' {
  if (totalEarned >= TIER_THRESHOLDS.gold) return 'gold';
  if (totalEarned >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

/** Points earned on an invoice: floor(total × rate). */
export function pointsForInvoice(totalAmount: number, pointsPerCurrency: number): number {
  if (pointsPerCurrency <= 0) return 0;
  return Math.floor(totalAmount * pointsPerCurrency);
}

export class LoyaltyService {
  private readonly repo: LoyaltyRepository;
  readonly organizationId: string;

  constructor(repo: LoyaltyRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): LoyaltyService {
    return new LoyaltyService(LoyaltyRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Programs
  // -------------------------------------------------------------------------

  async listPrograms() {
    return this.repo.listPrograms();
  }

  async createProgram(input: { name: string; pointsPerCurrency: number }) {
    if (input.pointsPerCurrency < 0) {
      throw new UnprocessableError('Points per currency must not be negative.');
    }
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createProgram({ branchId, ...input });
  }

  // -------------------------------------------------------------------------
  // Accounts
  // -------------------------------------------------------------------------

  async listAccounts(filter: { tier?: string } = {}) {
    return this.repo.listAccounts(filter);
  }

  async getAccount(id: string) {
    return this.repo.getAccount(id);
  }

  async listTransactions(accountId: string) {
    await this.repo.getAccount(accountId);
    return this.repo.listTransactions(accountId);
  }

  /**
   * Redeems points for a reward. Refuses when the balance is insufficient —
   * a spend can never take the balance below zero.
   */
  async redeem(input: { accountId: string; points: number; reason?: string }) {
    if (!Number.isInteger(input.points) || input.points <= 0) {
      throw new UnprocessableError('Redemption points must be a positive integer.');
    }

    const account = await this.repo.getAccount(input.accountId);
    if (account.balance < input.points) {
      throw new ConflictError(
        `Insufficient balance: ${account.balance} points available, ${input.points} requested.`,
      );
    }

    const branchId = await this.repo.resolveDefaultBranch();
    try {
      return await this.repo.applyPoints({
        branchId,
        accountId: account.id,
        points: -input.points,
        tier: account.tier,
        kind: 'spend',
        reason: input.reason ?? 'Reward redemption',
      });
    } catch (error) {
      if ((error as { message?: string }).message === 'INSUFFICIENT_POINTS') {
        throw new ConflictError('Insufficient points balance.');
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Coupons
  // -------------------------------------------------------------------------

  async listCoupons() {
    return this.repo.listCoupons();
  }

  async createCoupon(input: {
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    expiresAt?: string;
    maxRedemptions?: number;
  }) {
    if (input.type === 'percent' && (input.value < 0 || input.value > 100)) {
      throw new UnprocessableError('A percent coupon must be between 0 and 100.');
    }
    if (input.value < 0) {
      throw new UnprocessableError('Coupon value must not be negative.');
    }
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createCoupon({
      branchId,
      code: input.code,
      type: input.type,
      value: input.value,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      maxRedemptions: input.maxRedemptions,
    });
  }

  /**
   * Redeems a coupon for a contact. One use per contact (unique guard), a
   * per-coupon limit, and an expiry check.
   */
  async redeemCoupon(input: { couponId: string; contactId: string; invoiceId: string }) {
    const coupon = await this.repo.getCoupon(input.couponId);
    if (!(await this.repo.contactExists(input.contactId))) {
      throw new NotFoundError('Contact not found.');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new ConflictError('This coupon has expired.');
    }
    const invoice = await this.repo.getDraftInvoiceForCoupon(
      input.invoiceId,
      input.contactId,
    );
    if (invoice.discountAmount > 0) {
      throw new ConflictError('This invoice already has a coupon discount.');
    }
    const discountAmount = Math.min(
      invoice.totalAmount,
      coupon.type === 'percent'
        ? Math.round(invoice.totalAmount * coupon.value) / 100
        : coupon.value,
    );
    if (discountAmount <= 0)
      throw new ConflictError('This coupon has no discount value.');
    try {
      return await this.repo.createRedemption({
        branchId: invoice.branchId,
        ...input,
        discountAmount,
      });
    } catch (error) {
      const code = (error as { code?: string; message?: string })?.code;
      const message = (error as { message?: string })?.message;
      if (code === 'P2002')
        throw new ConflictError('This coupon or invoice was already redeemed.');
      if (message === 'COUPON_LIMIT_REACHED') {
        throw new ConflictError('This coupon has reached its redemption limit.');
      }
      if (message === 'INVOICE_COUPON_CONFLICT') {
        throw new ConflictError('This invoice already has a coupon discount.');
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Referrals
  // -------------------------------------------------------------------------

  async listReferrals() {
    return this.repo.listReferrals();
  }

  async createReferral(input: { referrerId: string; referredContactId: string }) {
    if (input.referrerId === input.referredContactId) {
      throw new UnprocessableError('A contact cannot refer themselves.');
    }
    if (!(await this.repo.contactExists(input.referrerId))) {
      throw new NotFoundError('Referrer not found.');
    }
    if (!(await this.repo.contactExists(input.referredContactId))) {
      throw new NotFoundError('Referred contact not found.');
    }
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createReferral({
      branchId,
      ...input,
      bonusPoints: DEFAULT_REFERRAL_BONUS,
    });
  }

  // -------------------------------------------------------------------------
  // Earn worker step
  // -------------------------------------------------------------------------

  /**
   * Worker step: find paid invoices that have not yet earned points, credit the
   * contact's account, and resolve referral bonuses. Idempotent via the unique
   * (invoiceId, kind) transaction guard — a re-run cannot double-award.
   */
  async processEarnings(): Promise<number> {
    const invoices = await this.repo.listUnearnedPaidInvoices();
    if (invoices.length === 0) return 0;

    const program = await this.repo.findEnabledProgram();
    if (!program) return 0;

    const branchId = await this.repo.resolveDefaultBranch();
    let earned = 0;

    for (const invoice of invoices) {
      try {
        const points = pointsForInvoice(
          Number(invoice.totalAmount),
          program.pointsPerCurrency,
        );
        if (points <= 0) continue;

        // Account per contact (create on first earn).
        let account: LoyaltyAccountRow | null = await this.repo.getAccountByContact(
          invoice.contactId,
          program.id,
        );
        if (!account) {
          account = await this.repo.createAccount({
            branchId,
            contactId: invoice.contactId,
            programId: program.id,
          });
        }

        const newTotal = account.totalEarned + points;
        await this.repo.applyPoints({
          branchId,
          accountId: account.id,
          points,
          tier: tierFor(newTotal),
          kind: 'earn',
          invoiceId: invoice.id,
          reason: `Paid invoice ${invoice.id.slice(0, 8)}`,
        });

        // Referral bonus: when the referred contact earns for the first time,
        // the referrer gets a bonus.
        const pending = await this.repo.listPendingReferralsFor(invoice.contactId);
        for (const referral of pending) {
          // The referrer's account is created on first bonus, like first earn.
          let referrerAccount = await this.repo.getAccountByContact(
            referral.referrerId,
            program.id,
          );
          if (!referrerAccount) {
            referrerAccount = await this.repo.createAccount({
              branchId,
              contactId: referral.referrerId,
              programId: program.id,
            });
          }
          const bonus =
            referral.bonusPoints > 0 ? referral.bonusPoints : DEFAULT_REFERRAL_BONUS;
          await this.repo.applyPoints({
            branchId,
            accountId: referrerAccount.id,
            points: bonus,
            tier: tierFor(referrerAccount.totalEarned + bonus),
            kind: 'referral_bonus',
            reason: `Referral bonus for ${referral.referredDisplayName}`,
          });
          await this.repo.markReferralRewarded(referral.id);
        }

        earned += 1;
      } catch (error) {
        // P2002 — this invoice already earned points. A re-run is a no-op.
        const code = (error as { code?: string })?.code;
        if (code !== 'P2002') throw error;
      }
    }

    return earned;
  }
}
