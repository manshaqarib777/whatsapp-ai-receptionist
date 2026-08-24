import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';
import { LoyaltyBaseRepository } from './loyalty.base';
import type { CouponRedemptionRow, CouponRow } from './loyalty.types';

const COUPON_SELECT = {
  id: true,
  code: true,
  type: true,
  value: true,
  expiresAt: true,
  maxRedemptions: true,
  createdAt: true,
  redemptions: { select: { id: true }, where: { deletedAt: null } },
} as const;

export class LoyaltyCouponsRepository extends LoyaltyBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listCoupons(): Promise<CouponRow[]> {
    const rows = await this.db.coupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: COUPON_SELECT,
    });
    return rows.map(toCouponRow);
  }

  async getCoupon(id: string): Promise<CouponRow> {
    const row = await this.db.coupon.findFirst({
      where: { id, deletedAt: null },
      select: COUPON_SELECT,
    });
    if (!row) throw new NotFoundError('Coupon not found.');
    return toCouponRow(row);
  }

  async createCoupon(input: {
    branchId: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    expiresAt?: Date;
    maxRedemptions?: number;
  }): Promise<CouponRow> {
    const row = await this.writeScope(input.branchId).coupon.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        code: input.code,
        type: input.type,
        value: input.value,
        expiresAt: input.expiresAt ?? null,
        maxRedemptions: input.maxRedemptions ?? 1,
      },
      select: COUPON_SELECT,
    });
    return toCouponRow(row);
  }

  async createRedemption(input: {
    branchId: string;
    couponId: string;
    contactId: string;
    invoiceId: string;
    discountAmount: number;
  }): Promise<CouponRedemptionRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM coupons WHERE id = $1::uuid FOR UPDATE',
        input.couponId,
      );
      const coupon = await tx.coupon.findFirstOrThrow({
        where: { id: input.couponId, deletedAt: null },
        select: {
          maxRedemptions: true,
          _count: { select: { redemptions: { where: { deletedAt: null } } } },
        },
      });
      if (coupon._count.redemptions >= coupon.maxRedemptions) {
        throw new Error('COUPON_LIMIT_REACHED');
      }
      const created = await tx.couponRedemption.create({
        data: {
          organizationId: this.organizationId,
          branchId: input.branchId,
          couponId: input.couponId,
          contactId: input.contactId,
          invoiceId: input.invoiceId,
          discountAmount: input.discountAmount,
        },
        select: {
          id: true,
          couponId: true,
          contactId: true,
          invoiceId: true,
          discountAmount: true,
          redeemedAt: true,
          coupon: { select: { code: true } },
          contact: { select: { displayName: true } },
        },
      });
      const updated = await tx.invoice.updateMany({
        where: { id: input.invoiceId, status: 'draft', discountAmount: 0 },
        data: {
          discountAmount: input.discountAmount,
          totalAmount: { decrement: input.discountAmount },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error('INVOICE_COUPON_CONFLICT');
      return created;
    });
    return toRedemptionRow(row);
  }

  async getDraftInvoiceForCoupon(invoiceId: string, contactId: string) {
    const invoice = await this.db.invoice.findFirst({
      where: { id: invoiceId, contactId, status: 'draft', deletedAt: null },
      select: { id: true, branchId: true, totalAmount: true, discountAmount: true },
    });
    if (!invoice) throw new NotFoundError('Draft invoice not found for this contact.');
    return {
      ...invoice,
      totalAmount: Number(invoice.totalAmount),
      discountAmount: Number(invoice.discountAmount),
    };
  }
}

function toCouponRow(row: {
  id: string;
  code: string;
  type: string;
  value: unknown;
  expiresAt: Date | null;
  maxRedemptions: number;
  createdAt: Date;
  redemptions: { id: string }[];
}): CouponRow {
  return {
    ...row,
    type: row.type as CouponRow['type'],
    value: Number(row.value),
    redemptionCount: row.redemptions.length,
  };
}

function toRedemptionRow(row: {
  id: string;
  couponId: string;
  contactId: string;
  invoiceId: string | null;
  discountAmount: unknown;
  redeemedAt: Date;
  coupon: { code: string };
  contact: { displayName: string };
}): CouponRedemptionRow {
  return {
    id: row.id,
    couponId: row.couponId,
    couponCode: row.coupon.code,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    invoiceId: row.invoiceId,
    discountAmount: Number(row.discountAmount),
    redeemedAt: row.redeemedAt,
  };
}
