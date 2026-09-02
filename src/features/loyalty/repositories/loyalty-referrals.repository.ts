import type { Scope } from '@/lib/db/scope';
import { LoyaltyBaseRepository } from './loyalty.base';
import type { ReferralRow } from './loyalty.types';

const SELECT = {
  id: true,
  referrerId: true,
  referredContactId: true,
  bonusPoints: true,
  status: true,
  createdAt: true,
  referrer: { select: { displayName: true } },
  referredContact: { select: { displayName: true } },
} as const;

export class LoyaltyReferralsRepository extends LoyaltyBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }
  async listReferrals(): Promise<ReferralRow[]> {
    const rows = await this.db.referral.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
    return rows.map(toReferralRow);
  }
  async createReferral(input: {
    branchId: string;
    referrerId: string;
    referredContactId: string;
    bonusPoints: number;
  }): Promise<ReferralRow> {
    const row = await this.writeScope(input.branchId).referral.create({
      data: { organizationId: this.organizationId, ...input },
      select: SELECT,
    });
    return toReferralRow(row);
  }
  async listPendingReferralsFor(referredContactId: string): Promise<ReferralRow[]> {
    const rows = await this.db.referral.findMany({
      where: { referredContactId, status: 'pending', deletedAt: null },
      select: SELECT,
    });
    return rows.map(toReferralRow);
  }
  async markReferralRewarded(id: string): Promise<void> {
    await this.db.referral.updateMany({ where: { id }, data: { status: 'rewarded' } });
  }
  async contactExists(id: string): Promise<boolean> {
    return (
      (await this.db.contact.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      })) !== null
    );
  }
}

function toReferralRow(row: {
  id: string;
  referrerId: string;
  referredContactId: string;
  bonusPoints: number;
  status: string;
  createdAt: Date;
  referrer: { displayName: string };
  referredContact: { displayName: string };
}): ReferralRow {
  return {
    id: row.id,
    referrerId: row.referrerId,
    referrerDisplayName: row.referrer.displayName,
    referredContactId: row.referredContactId,
    referredDisplayName: row.referredContact.displayName,
    bonusPoints: row.bonusPoints,
    status: row.status as ReferralRow['status'],
    createdAt: row.createdAt,
  };
}
