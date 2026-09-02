import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import type { DateRange, RevenueSeriesPoint } from './analytics.types';

export class AnalyticsRevenueRepository {
  private readonly db: ReturnType<typeof forScope>;
  constructor(scope: Scope) {
    this.db = forScope(scope);
  }

  async revenueByStatus(range: DateRange) {
    const rows = await this.db.invoice.groupBy({
      by: ['status'],
      where: { issuedAt: { gte: range.from, lte: range.to }, status: { not: 'void' } },
      _sum: { totalAmount: true },
    });
    return rows.map((row) => ({
      status: row.status,
      amount: Number(row._sum.totalAmount ?? 0),
    }));
  }

  async collectedRevenue(range: DateRange): Promise<number> {
    const aggregate = await this.db.payment.aggregate({
      where: { status: 'succeeded', capturedAt: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    });
    return Number(aggregate._sum.amount ?? 0);
  }

  async invoicedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    const rows = await this.db.invoice.findMany({
      where: { issuedAt: { gte: range.from, lte: range.to }, status: { not: 'void' } },
      select: { issuedAt: true, totalAmount: true },
      orderBy: { issuedAt: 'asc' },
    });
    return collapseToDay(
      rows,
      (row) => row.issuedAt,
      (row) => Number(row.totalAmount),
    );
  }

  async collectedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    const rows = await this.db.payment.findMany({
      where: { status: 'succeeded', capturedAt: { gte: range.from, lte: range.to } },
      select: { capturedAt: true, amount: true },
      orderBy: { capturedAt: 'asc' },
    });
    return collapseToDay(
      rows,
      (row) => row.capturedAt,
      (row) => Number(row.amount),
    );
  }

  async refundsIn(range: DateRange): Promise<number> {
    const aggregate = await this.db.refund.aggregate({
      where: { createdAt: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    });
    return Number(aggregate._sum.amount ?? 0);
  }
}

function collapseToDay<T extends Record<string, unknown>>(
  rows: T[],
  dateOf: (row: T) => Date | null,
  amountOf: (row: T) => number,
): RevenueSeriesPoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const date = dateOf(row);
    if (!date) continue;
    const key = date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + amountOf(row));
  }
  return [...byDay].map(([date, amount]) => ({
    date: new Date(`${date}T00:00:00Z`),
    amount,
  }));
}
