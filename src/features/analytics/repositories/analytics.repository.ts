import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';
import { AnalyticsPerformanceRepository } from './analytics-performance.repository';
import { AnalyticsRevenueRepository } from './analytics-revenue.repository';

import type {
  AppointmentStatusRow,
  CampaignDeliveryRow,
  ConversionFunnelRow,
  DateRange,
  ForecastDealRow,
  FunnelStageRow,
  LifecycleRow,
  PerformanceRow,
  RevenueSeriesPoint,
} from './analytics.types';

/**
 * Analytics data access — Milestone 15.
 *
 * The only layer that touches the database for analytics reads. Every query runs
 * through `forScope(scope)` with the org-level scope from `resolveScope`, so all
 * branches are included and tenant isolation is enforced in one place. Returns
 * raw rows and aggregates; the service owns the view model.
 */

export class AnalyticsRepository {
  private readonly db: ReturnType<typeof forScope>;
  private readonly revenue: AnalyticsRevenueRepository;
  private readonly performanceReads: AnalyticsPerformanceRepository;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.revenue = new AnalyticsRevenueRepository(scope);
    this.performanceReads = new AnalyticsPerformanceRepository(scope);
  }

  static forOrganization(organizationId: string): AnalyticsRepository {
    return new AnalyticsRepository(resolveScope(organizationId));
  }

  // -------------------------------------------------------------------------
  // Revenue
  // -------------------------------------------------------------------------

  /** Sum of invoice totals by status, within a range (issuedAt). */
  async revenueByStatus(range: DateRange): Promise<{ status: string; amount: number }[]> {
    return this.revenue.revenueByStatus(range);
  }

  /** Sum of successful captured payments within a range. */
  async collectedRevenue(range: DateRange): Promise<number> {
    return this.revenue.collectedRevenue(range);
  }

  /** Daily invoiced revenue series within a range. */
  async invoicedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    return this.revenue.invoicedSeries(range);
  }

  /** Daily collected revenue series within a range (paidAt). */
  async collectedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    return this.revenue.collectedSeries(range);
  }

  /** Sum of refunds created within a range. */
  async refundsIn(range: DateRange): Promise<number> {
    return this.revenue.refundsIn(range);
  }

  // -------------------------------------------------------------------------
  // Funnels
  // -------------------------------------------------------------------------

  /** Deals aggregated per pipeline stage, ordered by position. */
  async pipelineFunnel(): Promise<FunnelStageRow[]> {
    const stages = await this.db.pipelineStage.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        winProbability: true,
        deals: {
          where: { status: 'open' },
          select: { valueAmount: true },
        },
      },
    });

    return stages.map((stage) => ({
      stageName: stage.name,
      position: stage.position,
      winProbability: Number(stage.winProbability),
      openDeals: stage.deals.length,
      openValue: stage.deals.reduce((sum, deal) => sum + Number(deal.valueAmount), 0),
    }));
  }

  /** Counts for the quote → invoice → paid conversion funnel. */
  async conversionFunnel(range?: DateRange): Promise<ConversionFunnelRow> {
    const quoteRange = range ? { createdAt: { gte: range.from, lte: range.to } } : {};
    const [quotes, accepted, invoiced, paid] = await Promise.all([
      this.db.quote.count({ where: { ...quoteRange, status: { not: 'draft' } } }),
      this.db.quote.count({ where: { ...quoteRange, status: 'accepted' } }),
      this.db.quote.count({
        where: {
          ...quoteRange,
          status: 'accepted',
          invoices: { some: { status: { not: 'void' } } },
        },
      }),
      this.db.quote.count({
        where: {
          ...quoteRange,
          status: 'accepted',
          invoices: { some: { status: 'paid' } },
        },
      }),
    ]);

    return {
      quotes,
      quotesAccepted: accepted,
      quotesInvoiced: invoiced,
      quotesPaid: paid,
    };
  }

  /** Count of deals by status (won/lost). */
  async dealCountByStatus(status: 'won' | 'lost', range?: DateRange): Promise<number> {
    return this.db.deal.count({
      where: {
        status,
        ...(range ? { updatedAt: { gte: range.from, lte: range.to } } : {}),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Retention
  // -------------------------------------------------------------------------

  /** Contacts grouped by lifecycle stage. */
  async lifecycleCounts(): Promise<LifecycleRow[]> {
    const rows = await this.db.contact.groupBy({
      by: ['lifecycleStage'],
      _count: { _all: true },
    });
    return rows.map((row) => ({
      lifecycleStage: row.lifecycleStage,
      count: row._count._all,
    }));
  }

  /** Contacts created within a range. */
  async contactsCreatedIn(range: DateRange): Promise<number> {
    const matureBy = new Date(range.to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (matureBy < range.from) return 0;
    return this.db.contact.count({
      where: { createdAt: { gte: range.from, lte: matureBy } },
    });
  }

  /**
   * Of the contacts created in `range`, how many are still active: they have at
   * least one appointment, invoice, or conversation after their creation — a
   * behavioural retention measure rather than a lifecycle-field guess.
   */
  async activeCreatedContactsIn(range: DateRange): Promise<number> {
    const matureBy = new Date(range.to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (matureBy < range.from) return 0;
    const contacts = await this.db.contact.findMany({
      where: { createdAt: { gte: range.from, lte: matureBy } },
      select: {
        id: true,
        createdAt: true,
        appointments: { select: { createdAt: true } },
        invoices: { select: { createdAt: true } },
        conversations: { select: { lastMessageAt: true } },
      },
    });

    return contacts.filter((contact) => {
      const threshold = contact.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000;
      return (
        contact.appointments.some((row) => row.createdAt.getTime() >= threshold) ||
        contact.invoices.some((row) => row.createdAt.getTime() >= threshold) ||
        contact.conversations.some(
          (row) => row.lastMessageAt !== null && row.lastMessageAt.getTime() >= threshold,
        )
      );
    }).length;
  }

  // -------------------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------------------

  /** Appointments grouped by status within a range (startsAt). */
  async appointmentStatuses(range: DateRange): Promise<AppointmentStatusRow[]> {
    const rows = await this.db.appointment.groupBy({
      by: ['status'],
      where: { startsAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  /** Total value of appointments within a range (service price at booking time). */
  async bookingValue(range: DateRange): Promise<number> {
    const rows = await this.db.appointment.findMany({
      where: { startsAt: { gte: range.from, lte: range.to } },
      select: { service: { select: { priceAmount: true } } },
    });
    return rows.reduce((sum, row) => sum + Number(row.service?.priceAmount ?? 0), 0);
  }

  // -------------------------------------------------------------------------
  // Performance
  // -------------------------------------------------------------------------

  /** Conversation + escalation + assignee workload + first-response time. */
  async performance(range: DateRange): Promise<PerformanceRow> {
    return this.performanceReads.performance(range);
  }

  // -------------------------------------------------------------------------
  // Campaign delivery (surfaced under Performance)
  // -------------------------------------------------------------------------

  /** Campaign recipients grouped by delivery status within a range. */
  async campaignDeliveries(range: DateRange): Promise<CampaignDeliveryRow[]> {
    return this.performanceReads.campaignDeliveries(range);
  }

  // -------------------------------------------------------------------------
  // Forecasting
  // -------------------------------------------------------------------------

  /** Every open deal with its stage's win probability — the weighted forecast input. */
  async openDealsForForecast(): Promise<ForecastDealRow[]> {
    const rows = await this.db.deal.findMany({
      where: { status: 'open' },
      orderBy: { valueAmount: 'desc' },
      select: {
        id: true,
        title: true,
        valueAmount: true,
        stage: { select: { name: true, winProbability: true } },
      },
    });

    return rows.map((row) => ({
      dealId: row.id,
      name: row.title,
      valueAmount: Number(row.valueAmount),
      stageName: row.stage?.name ?? 'No stage',
      winProbability: Number(row.stage?.winProbability ?? 0),
    }));
  }

  /** Collected revenue per month over the last `months`, for the projection. */
  async collectedByMonth(months: number): Promise<{ month: string; amount: number }[]> {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - (months - 1));
    since.setUTCHours(0, 0, 0, 0);

    const rows = await this.db.invoice.findMany({
      where: { paidAt: { gte: since } },
      select: { paidAt: true, amountPaid: true },
      orderBy: { paidAt: 'asc' },
    });

    const byMonth = new Map<string, number>();
    for (const row of rows) {
      if (!row.paidAt) continue;
      const key = `${row.paidAt.getUTCFullYear()}-${String(row.paidAt.getUTCMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.amountPaid));
    }

    return [...byMonth.entries()]
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
