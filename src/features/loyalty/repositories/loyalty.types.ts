/**
 * Loyalty row types — Milestone 17.
 */

export type LoyaltyProgramRow = {
  id: string;
  name: string;
  pointsPerCurrency: number;
  isEnabled: boolean;
  createdAt: Date;
};

export type LoyaltyAccountRow = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  programId: string;
  programName: string;
  balance: number;
  totalEarned: number;
  tier: 'bronze' | 'silver' | 'gold';
  createdAt: Date;
};

export type LoyaltyTransactionRow = {
  id: string;
  accountId: string;
  invoiceId: string | null;
  kind: 'earn' | 'spend' | 'referral_bonus';
  pointsDelta: number;
  reason: string | null;
  createdAt: Date;
};

export type CouponRow = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  expiresAt: Date | null;
  maxRedemptions: number;
  redemptionCount: number;
  createdAt: Date;
};

export type CouponRedemptionRow = {
  id: string;
  couponId: string;
  couponCode: string;
  contactId: string;
  contactDisplayName: string;
  invoiceId: string | null;
  discountAmount: number;
  redeemedAt: Date;
};

export type ReferralRow = {
  id: string;
  referrerId: string;
  referrerDisplayName: string;
  referredContactId: string;
  referredDisplayName: string;
  bonusPoints: number;
  status: 'pending' | 'rewarded';
  createdAt: Date;
};
