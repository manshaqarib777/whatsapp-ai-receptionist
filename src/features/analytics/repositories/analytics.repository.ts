import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

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

  constructor(scope: Scope) {
    this.db = forScope(scope);
  }

  static forOrganization(organizationId: string): AnalyticsRepository {
    return new AnalyticsRepository(resolveScope(organizationId));
  }

  // -------------------------------------------------------------------------
  // Revenue
  // -------------------------------------------------------------------------

  /** Sum of invoice totals by status, within a range (issuedAt). */
  async revenueByStatus(range: DateRange): Promise<{ status: string; amount: number }[]> {
    const rows = await this.db.invoice.groupBy({
      by: ['status'],
      where: {
        issuedAt: { gte: range.from, lte: range.to },
        status: { not: 'void' },
      },
      _sum: { totalAmount: true },
    });
    return rows.map((row) => ({
      status: row.status,
      amount: Number(row._sum.totalAmount ?? 0),
    }));
  }

  /** Sum of collected amounts (amountPaid) within a range (paidAt). */
  async collectedRevenue(range: DateRange): Promise<number> {
    const agg = await this.db.invoice.aggregate({
      where: { paidAt: { gte: range.from, lte: range.to } },
      _sum: { amountPaid: true },
    });
    return Number(agg._sum.amountPaid ?? 0);
  }

  /** Daily invoiced revenue series within a range. */
  async invoicedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    const rows = await this.db.invoice.findMany({
      where: {
        issuedAt: { gte: range.from, lte: range.to },
        status: { not: 'void' },
      },
      select: { issuedAt: true, totalAmount: true },
      orderBy: { issuedAt: 'asc' },
    });

    return collapseToDay(
      rows,
      (row) => row.issuedAt,
      (row) => Number(row.totalAmount),
    );
  }

  /** Daily collected revenue series within a range (paidAt). */
  async collectedSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    const rows = await this.db.invoice.findMany({
      where: { paidAt: { gte: range.from, lte: range.to } },
      select: { paidAt: true, amountPaid: true },
      orderBy: { paidAt: 'asc' },
    });

    return collapseToDay(
      rows,
      (row) => row.paidAt,
      (row) => Number(row.amountPaid),
    );
  }

  /** Sum of refunds created within a range. */
  async refundsIn(range: DateRange): Promise<number> {
    const agg = await this.db.refund.aggregate({
      where: { createdAt: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
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
  async conversionFunnel(): Promise<ConversionFunnelRow> {
    const [quotes, accepted, invoiced, paid] = await Promise.all([
      this.db.quote.count({ where: { status: { not: 'draft' } } }),
      this.db.quote.count({ where: { status: 'accepted' } }),
      this.db.quote.count({
        where: {
          status: 'accepted',
          invoices: { some: { status: { not: 'void' } } },
        },
      }),
      this.db.quote.count({
        where: {
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
  async dealCountByStatus(status: 'won' | 'lost'): Promise<number> {
    return this.db.deal.count({ where: { status } });
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
    return this.db.contact.count({
      where: { createdAt: { gte: range.from, lte: range.to } },
    });
  }

  /**
   * Of the contacts created in `range`, how many are still active: they have at
   * least one appointment, invoice, or conversation after their creation — a
   * behavioural retention measure rather than a lifecycle-field guess.
   */
  async activeCreatedContactsIn(range: DateRange): Promise<number> {
    const contacts = await this.db.contact.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: {
        id: true,
        createdAt: true,
        appointments: {
          where: { createdAt: { gt: range.to } },
          select: { id: true },
          take: 1,
        },
        invoices: {
          where: { createdAt: { gt: range.to } },
          select: { id: true },
          take: 1,
        },
        conversations: {
          where: { lastMessageAt: { gt: range.to } },
          select: { id: true },
          take: 1,
        },
      },
    });

    return contacts.filter(
      (contact) =>
        contact.appointments.length > 0 ||
        contact.invoices.length > 0 ||
        contact.conversations.length > 0,
    ).length;
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
    const [conversations, escalated, assigneeRows, responseTimeSeconds] =
      await Promise.all([
        this.db.conversation.count({
          where: { createdAt: { gte: range.from, lte: range.to } },
        }),
        this.db.conversation.count({
          where: {
            createdAt: { gte: range.from, lte: range.to },
            isEscalated: true,
          },
        }),
        this.db.conversation.groupBy({
          by: ['assigneeId'],
          where: { createdAt: { gte: range.from, lte: range.to } },
          _count: { _all: true },
          orderBy: { _count: { assigneeId: 'desc' } },
        }),
        this.averageResponseTimeSeconds(range),
      ]);

    // Resolve assignee names (groupBy cannot include the relation).
    const userIds = assigneeRows
      .map((row) => row.assigneeId)
      .filter((id): id is string => id !== null);
    const users =
      userIds.length > 0
        ? await this.db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(users.map((user) => [user.id, user.name]));

    const assignedConversations = assigneeRows.map((row) => ({
      assigneeName: row.assigneeId
        ? (nameById.get(row.assigneeId) ?? 'Unassigned')
        : 'Unassigned',
      count: row._count._all,
    }));

    return {
      conversations,
      escalated,
      assignedConversations,
      responseTimeSeconds,
    };
  }

  /** Average first-response time in seconds for conversations in the range. */
  private async averageResponseTimeSeconds(range: DateRange): Promise<number | null> {
    const conversations = await this.db.conversation.findMany({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        messages: { some: { direction: 'inbound' } },
      },
      select: {
        id: true,
        messages: {
          where: { direction: 'inbound' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    if (conversations.length === 0) return null;

    let totalSeconds = 0;
    let measured = 0;

    for (const conversation of conversations) {
      const firstInbound = conversation.messages[0];
      if (!firstInbound) continue;

      const firstOutbound = await this.db.message.findFirst({
        where: {
          conversationId: conversation.id,
          direction: 'outbound',
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      if (!firstOutbound) continue;

      const gapMs = firstOutbound.createdAt.getTime() - firstInbound.createdAt.getTime();
      if (gapMs < 0) continue;

      totalSeconds += gapMs / 1000;
      measured += 1;
    }

    return measured === 0 ? null : totalSeconds / measured;
  }

  // -------------------------------------------------------------------------
  // Campaign delivery (surfaced under Performance)
  // -------------------------------------------------------------------------

  /** Campaign recipients grouped by delivery status within a range. */
  async campaignDeliveries(range: DateRange): Promise<CampaignDeliveryRow[]> {
    const rows = await this.db.campaignRecipient.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
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

/** Collapses rows with a nullable date + amount into daily totals. */
function collapseToDay<T extends { [key: string]: unknown }>(
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

  return [...byDay.entries()]
    .map(([date, amount]) => ({ date: new Date(`${date}T00:00:00Z`), amount }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
