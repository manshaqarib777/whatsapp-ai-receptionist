import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Dashboard data access.
 *
 * The only layer that touches the database for dashboard reads. Every query runs
 * through `forScope(scope)` — the tenant isolation control — with the scope built by
 * `resolveScope` from the session-derived organization id. No dashboard query may
 * hand-write its own `where.organizationId`.
 *
 * ## Why the repository returns raw rows, not the view model
 *
 * The service layer (dashboard.service.ts) owns presentation concerns: deltas,
 * sentiment, chart bucket building, currency formatting. Keeping the repository to
 * raw counts, sums, and bounded row lists means the expensive decisions live where
 * they can be unit-tested without a database.
 */

export type DateRange = { from: Date; to: Date };

export type ConversationSeriesPoint = { date: Date; count: number };
export type RevenueSeriesPoint = { date: Date; amount: number };

export type RecentConversation = {
  id: string;
  contactDisplayName: string;
  contactLocale: string;
  status: string;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
};

export type UpcomingAppointment = {
  id: string;
  contactDisplayName: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  branchId: string;
};

export type ActivityFeedItem = {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  body: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type DashboardCounts = {
  newConversations: number;
  previousNewConversations: number;
  responseTimeSeconds: number | null;
  previousResponseTimeSeconds: number | null;
  openRevenueAmount: number;
  previousOpenRevenueAmount: number;
  openDeals: number;
  previousOpenDeals: number;
};

/**
 * One repository instance bound to one tenant scope.
 *
 * The scope is fixed at construction from the session; a single instance may serve
 * the whole page render without re-resolving or re-extending per query.
 */
export class DashboardRepository {
  private readonly db: ReturnType<typeof forScope>;

  constructor(scope: Scope) {
    this.db = forScope(scope);
  }

  /**
   * Builds a repository from an organization id, resolving the org-level scope
   * (all branches) the dashboard reads across.
   */
  static forOrganization(organizationId: string): DashboardRepository {
    return new DashboardRepository(resolveScope(organizationId));
  }

  async countNewConversations(range: DateRange): Promise<number> {
    return this.db.conversation.count({
      where: { createdAt: { gte: range.from, lte: range.to } },
    });
  }

  /**
   * Average first-response time in seconds for conversations started in `range`:
   * the gap between the contact's first inbound message and the staff's first
   * outbound reply, measured per conversation then averaged.
   */
  async averageResponseTimeSeconds(range: DateRange): Promise<number | null> {
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

  async openRevenueAmount(): Promise<number> {
    const agg = await this.db.invoice.aggregate({
      where: { status: { in: ['issued', 'partially_paid', 'overdue'] } },
      _sum: { totalAmount: true },
    });
    return Number(agg._sum.totalAmount ?? 0);
  }

  /**
   * Open revenue as it stood at `asOf`: the issued-but-unpaid balance then.
   *
   * The delta for a stock measure compares the current stock against the same stock
   * at the start of the range rather than against a flow in the previous period.
   */
  async openRevenueAsOf(asOf: Date): Promise<number> {
    const agg = await this.db.invoice.aggregate({
      where: {
        status: { in: ['issued', 'partially_paid', 'overdue'] },
        issuedAt: { lte: asOf },
      },
      _sum: { totalAmount: true },
    });
    return Number(agg._sum.totalAmount ?? 0);
  }

  async openDealCount(): Promise<number> {
    return this.db.deal.count({ where: { status: 'open' } });
  }

  async countOpenDealsIn(range: DateRange): Promise<number> {
    return this.db.deal.count({
      where: { status: 'open', createdAt: { gte: range.from, lte: range.to } },
    });
  }

  async conversationSeries(range: DateRange): Promise<ConversationSeriesPoint[]> {
    const rows = await this.db.conversation.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      orderBy: { createdAt: 'asc' },
    });

    // groupBy over a timestamp key buckets by exact instant, so collapse to day
    // boundaries here rather than in SQL (where timezone handling would creep in).
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + row._count._all);
    }

    return [...byDay.entries()]
      .map(([date, count]) => ({ date: new Date(`${date}T00:00:00Z`), count }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async revenueSeries(range: DateRange): Promise<RevenueSeriesPoint[]> {
    // Open revenue at a point in time is expensive to reconstruct from `paid` rows;
    // the dashboard's revenue chart shows the cumulative value of invoices issued
    // in the range, which is the number that changes as the tenant grows.
    const rows = await this.db.invoice.findMany({
      where: {
        issuedAt: { gte: range.from, lte: range.to },
        status: { not: 'void' },
      },
      select: { issuedAt: true, totalAmount: true },
      orderBy: { issuedAt: 'asc' },
    });

    const byDay = new Map<string, number>();
    for (const row of rows) {
      if (!row.issuedAt) continue;
      const key = row.issuedAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + Number(row.totalAmount));
    }

    return [...byDay.entries()]
      .map(([date, amount]) => ({ date: new Date(`${date}T00:00:00Z`), amount }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async recentConversations(limit: number): Promise<RecentConversation[]> {
    const rows = await this.db.conversation.findMany({
      where: { status: { not: 'archived' } },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        branchId: true,
        contact: { select: { displayName: true, locale: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      contactDisplayName: row.contact.displayName,
      contactLocale: row.contact.locale,
      status: row.status,
      unreadCount: row.unreadCount,
      lastMessageAt: row.lastMessageAt,
      branchId: row.branchId,
    }));
  }

  async upcomingAppointments(limit: number): Promise<UpcomingAppointment[]> {
    const rows = await this.db.appointment.findMany({
      where: {
        startsAt: { gte: new Date() },
        status: { in: ['booked', 'confirmed'] },
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        branchId: true,
        contact: { select: { displayName: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      contactDisplayName: row.contact.displayName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      branchId: row.branchId,
    }));
  }

  async activityFeed(limit: number): Promise<ActivityFeedItem[]> {
    const rows = await this.db.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        kind: true,
        subjectType: true,
        subjectId: true,
        body: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      body: row.body,
      actorName: row.actor?.name ?? null,
      createdAt: row.createdAt,
    }));
  }

  /**
   * A user's notifications in the active org, unread first.
   *
   * Notifications are org-scoped (a user may be notified about any branch they can
   * access) and additionally filtered by user id here.
   *
   * Ordering: unread (readAt NULL) before read, then newest first. Prisma's default
   * `asc` sorts NULLs last in Postgres, which would bury the unread row — so the
   * readAt tie-break is explicit rather than left to the database.
   */
  async listNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
    const rows = await this.db.notification.findMany({
      where: { userId },
      orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });

    return rows;
  }
}

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
};
