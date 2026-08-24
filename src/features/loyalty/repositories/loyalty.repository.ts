import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { LoyaltyBaseRepository } from './loyalty.base';
import { LoyaltyCouponsRepository } from './loyalty-coupons.repository';
import { LoyaltyReferralsRepository } from './loyalty-referrals.repository';
import { LoyaltyProgramsRepository } from './loyalty-programs.repository';
import { toAccountRow, toTransactionRow } from './loyalty.mappers';
import type {
  CouponRedemptionRow,
  CouponRow,
  LoyaltyAccountRow,
  LoyaltyProgramRow,
  LoyaltyTransactionRow,
  ReferralRow,
} from './loyalty.types';

/**
 * Loyalty data access — Milestone 17.
 *
 * Programs, accounts, transactions, coupons, redemptions, and referrals.
 * Every query runs through the scoped client; writes derive a branch scope.
 * The service owns the points math, tier derivation, and redeem guards; this
 * layer is raw rows.
 */

const ACCOUNT_SELECT = {
  id: true,
  contactId: true,
  programId: true,
  balance: true,
  totalEarned: true,
  tier: true,
  createdAt: true,
  contact: { select: { displayName: true } },
  program: { select: { name: true } },
} as const;

export class LoyaltyRepository extends LoyaltyBaseRepository {
  private readonly coupons: LoyaltyCouponsRepository;
  private readonly referrals: LoyaltyReferralsRepository;
  private readonly programs: LoyaltyProgramsRepository;

  constructor(scope: Scope) {
    super(scope);
    this.coupons = new LoyaltyCouponsRepository(scope);
    this.referrals = new LoyaltyReferralsRepository(scope);
    this.programs = new LoyaltyProgramsRepository(scope);
  }

  async listPrograms(): Promise<LoyaltyProgramRow[]> {
    return this.programs.listPrograms();
  }

  async getProgram(id: string): Promise<LoyaltyProgramRow> {
    return this.programs.getProgram(id);
  }

  async createProgram(input: {
    branchId: string;
    name: string;
    pointsPerCurrency: number;
  }): Promise<LoyaltyProgramRow> {
    return this.programs.createProgram(input);
  }

  /** The first enabled program, or null. */
  async findEnabledProgram(): Promise<LoyaltyProgramRow | null> {
    return this.programs.findEnabledProgram();
  }

  async listAccounts(filter: { tier?: string } = {}): Promise<LoyaltyAccountRow[]> {
    const rows = await this.db.loyaltyAccount.findMany({
      where: {
        deletedAt: null,
        ...(filter.tier ? { tier: filter.tier as never } : {}),
      },
      orderBy: { totalEarned: 'desc' },
      select: ACCOUNT_SELECT,
    });
    return rows.map(toAccountRow);
  }

  async getAccount(id: string): Promise<LoyaltyAccountRow> {
    const row = await this.db.loyaltyAccount.findFirst({
      where: { id, deletedAt: null },
      select: ACCOUNT_SELECT,
    });
    if (!row) throw new NotFoundError('Loyalty account not found.');
    return toAccountRow(row);
  }

  async getAccountByContact(
    contactId: string,
    programId: string,
  ): Promise<LoyaltyAccountRow | null> {
    const row = await this.db.loyaltyAccount.findFirst({
      where: { contactId, programId, deletedAt: null },
      select: ACCOUNT_SELECT,
    });
    return row ? toAccountRow(row) : null;
  }

  async createAccount(input: {
    branchId: string;
    contactId: string;
    programId: string;
  }): Promise<LoyaltyAccountRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.loyaltyAccount.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId,
        programId: input.programId,
      },
      select: ACCOUNT_SELECT,
    });
    return toAccountRow(row);
  }

  /**
   * Credits an account and updates its tier from the new total. Runs in a
   * transaction with the ledger row so the balance and the ledger never diverge.
   */
  async applyPoints(input: {
    branchId: string;
    accountId: string;
    points: number;
    tier: 'bronze' | 'silver' | 'gold';
    kind: 'earn' | 'spend' | 'referral_bonus';
    invoiceId?: string;
    reason?: string;
  }): Promise<{ account: LoyaltyAccountRow; transaction: LoyaltyTransactionRow }> {
    const db = this.writeScope(input.branchId);
    const result = await db.$transaction(async (tx) => {
      // updateMany rather than update: the tenant-scoped client forbids
      // update-by-unique-key (the tenant filter could not be injected).
      const updated = await tx.loyaltyAccount.updateMany({
        where: {
          id: input.accountId,
          ...(input.kind === 'spend' ? { balance: { gte: -input.points } } : {}),
        },
        data: {
          balance: { increment: input.points },
          ...(input.kind === 'spend'
            ? {}
            : { totalEarned: { increment: input.points }, tier: input.tier }),
        },
      });
      if (updated.count !== 1) throw new Error('INSUFFICIENT_POINTS');

      const account = await tx.loyaltyAccount.findFirstOrThrow({
        where: { id: input.accountId },
        select: ACCOUNT_SELECT,
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          organizationId: this.organizationId,
          branchId: input.branchId,
          accountId: input.accountId,
          invoiceId: input.invoiceId ?? null,
          kind: input.kind,
          pointsDelta: input.points,
          reason: input.reason ?? null,
        },
        select: {
          id: true,
          accountId: true,
          invoiceId: true,
          kind: true,
          pointsDelta: true,
          reason: true,
          createdAt: true,
        },
      });

      return { account, transaction };
    });

    return {
      account: toAccountRow(result.account),
      transaction: toTransactionRow(result.transaction),
    };
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  async listTransactions(accountId: string): Promise<LoyaltyTransactionRow[]> {
    const rows = await this.db.loyaltyTransaction.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        accountId: true,
        invoiceId: true,
        kind: true,
        pointsDelta: true,
        reason: true,
        createdAt: true,
      },
    });
    return rows.map(toTransactionRow);
  }

  /** Paid invoices that have not yet earned points — the worker's input. */
  async listUnearnedPaidInvoices(
    limit = 50,
  ): Promise<{ id: string; contactId: string; totalAmount: number; branchId: string }[]> {
    const rows = await this.db.invoice.findMany({
      where: {
        status: 'paid',
        paidAt: { not: null },
        loyaltyTransactions: { none: { kind: 'earn' } },
      },
      orderBy: { paidAt: 'asc' },
      take: limit,
      select: { id: true, contactId: true, totalAmount: true, branchId: true },
    });
    return rows.map((row) => ({
      id: row.id,
      contactId: row.contactId,
      totalAmount: Number(row.totalAmount),
      branchId: row.branchId,
    }));
  }

  // -------------------------------------------------------------------------
  // Coupons
  // -------------------------------------------------------------------------

  async listCoupons(): Promise<CouponRow[]> {
    return this.coupons.listCoupons();
  }

  async getCoupon(id: string): Promise<CouponRow> {
    return this.coupons.getCoupon(id);
  }

  async createCoupon(input: {
    branchId: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    expiresAt?: Date;
    maxRedemptions?: number;
  }): Promise<CouponRow> {
    return this.coupons.createCoupon(input);
  }

  async createRedemption(input: {
    branchId: string;
    couponId: string;
    contactId: string;
    invoiceId: string;
    discountAmount: number;
  }): Promise<CouponRedemptionRow> {
    return this.coupons.createRedemption(input);
  }

  async getDraftInvoiceForCoupon(invoiceId: string, contactId: string) {
    return this.coupons.getDraftInvoiceForCoupon(invoiceId, contactId);
  }

  // -------------------------------------------------------------------------
  // Referrals
  // -------------------------------------------------------------------------

  async listReferrals(): Promise<ReferralRow[]> {
    return this.referrals.listReferrals();
  }

  async createReferral(input: {
    branchId: string;
    referrerId: string;
    referredContactId: string;
    bonusPoints: number;
  }): Promise<ReferralRow> {
    return this.referrals.createReferral(input);
  }

  /** Pending referrals for a referred contact. */
  async listPendingReferralsFor(referredContactId: string): Promise<ReferralRow[]> {
    return this.referrals.listPendingReferralsFor(referredContactId);
  }

  async markReferralRewarded(id: string): Promise<void> {
    return this.referrals.markReferralRewarded(id);
  }

  /** Whether a contact exists and is not soft-deleted, org-scoped. */
  async contactExists(id: string): Promise<boolean> {
    return this.referrals.contactExists(id);
  }
}
