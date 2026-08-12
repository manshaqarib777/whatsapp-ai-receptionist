import {
  DashboardRepository,
  type ActivityFeedItem,
  type DateRange,
  type RecentConversation,
  type UpcomingAppointment,
} from '@/features/dashboard/repositories/dashboard.repository';

/**
 * Dashboard view model — pure orchestration over the repository.
 *
 * No database access here. The repository returns raw counts, sums, and bounded
 * row lists; this service composes them into the shape the widgets render, and
 * owns the presentation decisions that are unit-testable without a database:
 * delta/sentiment derivation, currency formatting, and chart bucket building.
 */

export type KpiMetric = {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  icon: 'conversation' | 'clock' | 'revenue' | 'leads';
  href: string;
};

export type ConversationTrendPoint = { date: Date; label: string; conversations: number };
export type RevenueTrendPoint = { date: Date; label: string; revenue: number };

export type DashboardData = {
  kpis: KpiMetric[];
  conversationTrend: ConversationTrendPoint[];
  revenueTrend: RevenueTrendPoint[];
  recentConversations: RecentConversation[];
  upcomingAppointments: UpcomingAppointment[];
  activityFeed: ActivityFeedItem[];
};

/** Pct change between two numbers, rounded; null when there is no baseline. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** Seconds → a human duration like "2m 14s" or "45s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

/** 4197.5 → "SAR 4,198". The seed is SAR; a multi-currency refactor can extend this. */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** "12 Aug" for a chart x-axis. Locale-aware via Intl, no manual month tables. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date);
}

const KPI_CONFIG = {
  conversation: { href: '/inbox' },
  clock: { href: '/inbox' },
  revenue: { href: '/reports' },
  leads: { href: '/contacts' },
} as const;

function previousRange(range: DateRange): DateRange {
  const lengthMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - lengthMs), to: range.from };
}

/** Count of rows created in a range, used for both the KPI and its baseline. */
function countCreated(repo: DashboardRepository, range: DateRange, model: 'conversation' | 'deal'): Promise<number> {
  return model === 'conversation' ? repo.countNewConversations(range) : repo.countOpenDealsIn(range);
}

async function buildKpis(repo: DashboardRepository, range: DateRange): Promise<KpiMetric[]> {
  const prev = previousRange(range);

  const [newConvs, prevNewConvs, responseTime, prevResponseTime, openDeals, prevDeals] = await Promise.all([
    countCreated(repo, range, 'conversation'),
    countCreated(repo, prev, 'conversation'),
    repo.averageResponseTimeSeconds(range),
    repo.averageResponseTimeSeconds(prev),
    countCreated(repo, range, 'deal'),
    countCreated(repo, prev, 'deal'),
  ]);

  // Open revenue is a point-in-time stock, not a range flow: the current total of
  // issued/partially-paid/overdue invoices. The delta compares it against the same
  // stock at the start of the range (itself a snapshot in the seed).
  const [openRevenue, prevOpenRevenue] = await Promise.all([
    repo.openRevenueAmount(),
    repo.openRevenueAsOf(range.from),
  ]);

  return [
    {
      label: 'New conversations',
      value: String(newConvs),
      delta: percentDelta(newConvs, prevNewConvs) ?? 0,
      deltaLabel: 'vs previous period',
      sentiment: 'positive',
      icon: 'conversation',
      href: KPI_CONFIG.conversation.href,
    },
    {
      label: 'Response time',
      value: responseTime === null ? '—' : formatDuration(responseTime),
      delta:
        responseTime === null || prevResponseTime === null
          ? 0
          : percentDelta(responseTime, prevResponseTime) ?? 0,
      deltaLabel: 'vs previous period',
      // Down is good for latency.
      sentiment: 'negative',
      icon: 'clock',
      href: KPI_CONFIG.clock.href,
    },
    {
      label: 'Open revenue',
      value: formatCurrency(openRevenue),
      delta: percentDelta(openRevenue, prevOpenRevenue) ?? 0,
      deltaLabel: 'since start of period',
      sentiment: 'positive',
      icon: 'revenue',
      href: KPI_CONFIG.revenue.href,
    },
    {
      label: 'Open leads',
      value: String(openDeals),
      delta: percentDelta(openDeals, prevDeals) ?? 0,
      deltaLabel: 'vs previous period',
      sentiment: 'positive',
      icon: 'leads',
      href: KPI_CONFIG.leads.href,
    },
  ];
}

/**
 * Fills a sparse day series into a dense date-keyed series covering `range`, so
 * the chart renders zero-fill buckets instead of gaps.
 */
export function fillSeries<TInput extends { date: Date }, TOutput extends { date: Date }>(
  points: TInput[],
  range: DateRange,
  mapPoint: (date: Date, existing?: TInput) => TOutput,
): TOutput[] {
  const byDay = new Map<string, TInput>();
  for (const point of points) byDay.set(point.date.toISOString().slice(0, 10), point);

  const out: TOutput[] = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setUTCHours(23, 59, 59, 999);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const existing = byDay.get(key);
    out.push(mapPoint(new Date(cursor), existing));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

/**
 * Assembles the full dashboard view model for one organization and one date range.
 *
 * Runs the KPI reads in parallel; the row-list reads are bounded and cheap enough
 * to run concurrently with them.
 */
export async function getDashboardData(organizationId: string, range: DateRange): Promise<DashboardData> {
  const repo = DashboardRepository.forOrganization(organizationId);

  const [kpis, recentConversations, upcomingAppointments, activityFeed] = await Promise.all([
    buildKpis(repo, range),
    repo.recentConversations(5),
    repo.upcomingAppointments(5),
    repo.activityFeed(8),
  ]);

  const [rawConversationSeries, rawRevenueSeries] = await Promise.all([
    repo.conversationSeries(range),
    repo.revenueSeries(range),
  ]);

  const conversationTrend = fillSeries(rawConversationSeries, range, (date, existing) => ({
    date,
    label: formatShortDate(date),
    conversations: existing?.count ?? 0,
  }));

  const revenueTrend = fillSeries(rawRevenueSeries, range, (date, existing) => ({
    date,
    label: formatShortDate(date),
    revenue: existing?.amount ?? 0,
  }));

  return { kpis, conversationTrend, revenueTrend, recentConversations, upcomingAppointments, activityFeed };
}

// ---------------------------------------------------------------------------
// Per-widget queries.
//
// The page renders each widget behind its own Suspense boundary (COMPONENT_DESIGN
// §7 — loading is per-widget). Each of these fetches exactly the data its widget
// needs, so a slow widget delays only itself. They share the repository's scoped
// client, so tenant isolation is identical to the combined read.
// ---------------------------------------------------------------------------

export async function getKpis(organizationId: string, range: DateRange): Promise<KpiMetric[]> {
  return buildKpis(DashboardRepository.forOrganization(organizationId), range);
}

export async function getConversationTrend(
  organizationId: string,
  range: DateRange,
): Promise<ConversationTrendPoint[]> {
  const repo = DashboardRepository.forOrganization(organizationId);
  const raw = await repo.conversationSeries(range);
  return fillSeries(raw, range, (date, existing) => ({
    date,
    label: formatShortDate(date),
    conversations: existing?.count ?? 0,
  }));
}

export async function getRevenueTrend(
  organizationId: string,
  range: DateRange,
): Promise<RevenueTrendPoint[]> {
  const repo = DashboardRepository.forOrganization(organizationId);
  const raw = await repo.revenueSeries(range);
  return fillSeries(raw, range, (date, existing) => ({
    date,
    label: formatShortDate(date),
    revenue: existing?.amount ?? 0,
  }));
}

export async function getRecentConversations(
  organizationId: string,
): Promise<RecentConversation[]> {
  return DashboardRepository.forOrganization(organizationId).recentConversations(5);
}

export async function getUpcomingAppointments(
  organizationId: string,
): Promise<UpcomingAppointment[]> {
  return DashboardRepository.forOrganization(organizationId).upcomingAppointments(5);
}

export async function getActivityFeed(organizationId: string): Promise<ActivityFeedItem[]> {
  return DashboardRepository.forOrganization(organizationId).activityFeed(8);
}
