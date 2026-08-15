/**
 * Dashboard row types — Milestone 5.
 *
 * The dashboard repository returns raw counts, sums, and bounded row lists;
 * the service layer owns the view model (deltas, sentiment, chart buckets).
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

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
};
