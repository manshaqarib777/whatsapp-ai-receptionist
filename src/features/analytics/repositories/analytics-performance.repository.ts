import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import type { CampaignDeliveryRow, DateRange, PerformanceRow } from './analytics.types';

export class AnalyticsPerformanceRepository {
  private readonly db: ReturnType<typeof forScope>;
  constructor(scope: Scope) {
    this.db = forScope(scope);
  }

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
    const userIds = assigneeRows
      .map((row) => row.assigneeId)
      .filter((id): id is string => id !== null);
    const users = userIds.length
      ? await this.db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((user) => [user.id, user.name]));
    return {
      conversations,
      escalated,
      responseTimeSeconds,
      assignedConversations: assigneeRows.map((row) => ({
        assigneeName: row.assigneeId
          ? (names.get(row.assigneeId) ?? 'Unassigned')
          : 'Unassigned',
        count: row._count._all,
      })),
    };
  }

  private async averageResponseTimeSeconds(range: DateRange): Promise<number | null> {
    const conversations = await this.db.conversation.findMany({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        messages: { some: { direction: 'inbound' } },
      },
      select: {
        messages: {
          where: { direction: { in: ['inbound', 'outbound'] } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true, direction: true },
        },
      },
    });
    const gaps = conversations.flatMap(({ messages }) => {
      const inbound = messages.find((message) => message.direction === 'inbound');
      if (!inbound) return [];
      const outbound = messages.find(
        (message) =>
          message.direction === 'outbound' && message.createdAt >= inbound.createdAt,
      );
      return outbound
        ? [(outbound.createdAt.getTime() - inbound.createdAt.getTime()) / 1000]
        : [];
    });
    return gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null;
  }

  async campaignDeliveries(range: DateRange): Promise<CampaignDeliveryRow[]> {
    const rows = await this.db.campaignRecipient.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }
}
