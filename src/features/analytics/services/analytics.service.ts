import { AnalyticsRepository } from '@/features/analytics/repositories/analytics.repository';
import type { DateRange } from '@/features/analytics/repositories/analytics.types';

/**
 * Analytics view model — Milestone 15.
 *
 * Pure orchestration over the repository: converts raw rows into the shapes the
 * sections render and owns the math that is unit-testable without a database —
 * deltas, conversion rates, the weighted forecast, and the trailing-average
 * projection. No SQL here; the repository is the only DB-touching layer.
 */

export type RevenueOverview = {
  invoiced: number;
  collected: number;
  outstanding: number;
  refunds: number;
  byStatus: { status: string; amount: number }[];
  invoicedSeries: { date: Date; label: string; amount: number }[];
  collectedSeries: { date: Date; label: string; amount: number }[];
};

export type FunnelSection = {
  pipeline: {
    stageName: string;
    openDeals: number;
    openValue: number;
    winProbability: number;
  }[];
  conversion: {
    quotes: number;
    accepted: number;
    invoiced: number;
    paid: number;
    acceptanceRate: number | null;
    invoiceRate: number | null;
    paymentRate: number | null;
  };
};

export type ConversionRates = {
  quoteAcceptanceRate: number | null;
  quoteToInvoiceRate: number | null;
  invoiceToPaidRate: number | null;
  dealWinRate: number | null;
  dealWinCount: number;
  dealLostCount: number;
};

export type RetentionOverview = {
  lifecycle: { lifecycleStage: string; count: number }[];
  createdInRange: number;
  activeOfCreated: number;
  retentionRate: number | null;
};

export type BookingsOverview = {
  byStatus: { status: string; count: number }[];
  total: number;
  value: number;
  cancelledCount: number;
  noShowCount: number;
  cancellationRate: number | null;
  noShowRate: number | null;
};

export type PerformanceOverview = {
  conversations: number;
  escalatedCount: number;
  escalationRate: number | null;
  responseTimeSeconds: number | null;
  assigned: { assigneeName: string; count: number }[];
  campaigns: { status: string; count: number }[];
};

export type ForecastOverview = {
  weighted: number;
  openValue: number;
  deals: number;
  byStage: { stageName: string; deals: number; value: number; weighted: number }[];
  projection: { month: string; amount: number }[];
  projectionIsEstimate: boolean;
};

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** Seconds → a human duration like "2m 14s" or "45s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date);
}

/** Rounded percentage; null when there is no baseline. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Fills a sparse daily series into a dense series covering the range. */
export function fillDailySeries<
  TInput extends { date: Date },
  TOutput extends { date: Date },
>(
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

export class AnalyticsService {
  private readonly repo: AnalyticsRepository;

  constructor(repo: AnalyticsRepository) {
    this.repo = repo;
  }

  static forOrganization(organizationId: string): AnalyticsService {
    return new AnalyticsService(AnalyticsRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Revenue
  // -------------------------------------------------------------------------

  async getRevenue(range: DateRange): Promise<RevenueOverview> {
    const [byStatus, collected, refunds, rawInvoiced, rawCollected] = await Promise.all([
      this.repo.revenueByStatus(range),
      this.repo.collectedRevenue(range),
      this.repo.refundsIn(range),
      this.repo.invoicedSeries(range),
      this.repo.collectedSeries(range),
    ]);

    const invoiced = byStatus.reduce((sum, row) => sum + row.amount, 0);
    const invoicedSeries = fillDailySeries(rawInvoiced, range, (date, existing) => ({
      date,
      label: formatShortDate(date),
      amount: existing?.amount ?? 0,
    }));
    const collectedSeries = fillDailySeries(rawCollected, range, (date, existing) => ({
      date,
      label: formatShortDate(date),
      amount: existing?.amount ?? 0,
    }));

    return {
      invoiced,
      collected,
      outstanding: Math.max(0, invoiced - collected),
      refunds,
      byStatus,
      invoicedSeries,
      collectedSeries,
    };
  }

  // -------------------------------------------------------------------------
  // Funnels
  // -------------------------------------------------------------------------

  async getFunnels(): Promise<FunnelSection> {
    const [pipeline, conversion] = await Promise.all([
      this.repo.pipelineFunnel(),
      this.repo.conversionFunnel(),
    ]);

    return {
      pipeline: pipeline.map((stage) => ({
        stageName: stage.stageName,
        openDeals: stage.openDeals,
        openValue: stage.openValue,
        winProbability: stage.winProbability,
      })),
      conversion: {
        quotes: conversion.quotes,
        accepted: conversion.quotesAccepted,
        invoiced: conversion.quotesInvoiced,
        paid: conversion.quotesPaid,
        acceptanceRate: rate(conversion.quotesAccepted, conversion.quotes),
        invoiceRate: rate(conversion.quotesInvoiced, conversion.quotesAccepted),
        paymentRate: rate(conversion.quotesPaid, conversion.quotesInvoiced),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Conversion
  // -------------------------------------------------------------------------

  async getConversion(): Promise<ConversionRates> {
    const [funnel, won, lost] = await Promise.all([
      this.repo.conversionFunnel(),
      this.repo.dealCountByStatus('won'),
      this.repo.dealCountByStatus('lost'),
    ]);

    const dealsClosed = won + lost;

    return {
      quoteAcceptanceRate: rate(funnel.quotesAccepted, funnel.quotes),
      quoteToInvoiceRate: rate(funnel.quotesInvoiced, funnel.quotesAccepted),
      invoiceToPaidRate: rate(funnel.quotesPaid, funnel.quotesInvoiced),
      dealWinRate: rate(won, dealsClosed),
      dealWinCount: won,
      dealLostCount: lost,
    };
  }

  // -------------------------------------------------------------------------
  // Retention
  // -------------------------------------------------------------------------

  async getRetention(range: DateRange): Promise<RetentionOverview> {
    const [lifecycle, createdInRange, activeOfCreated] = await Promise.all([
      this.repo.lifecycleCounts(),
      this.repo.contactsCreatedIn(range),
      this.repo.activeCreatedContactsIn(range),
    ]);

    return {
      lifecycle,
      createdInRange,
      activeOfCreated,
      retentionRate: rate(activeOfCreated, createdInRange),
    };
  }

  // -------------------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------------------

  async getBookings(range: DateRange): Promise<BookingsOverview> {
    const [byStatus, value] = await Promise.all([
      this.repo.appointmentStatuses(range),
      this.repo.bookingValue(range),
    ]);

    const total = byStatus.reduce((sum, row) => sum + row.count, 0);
    const cancelledCount = byStatus.find((row) => row.status === 'cancelled')?.count ?? 0;
    const noShowCount = byStatus.find((row) => row.status === 'no_show')?.count ?? 0;

    return {
      byStatus,
      total,
      value,
      cancelledCount,
      noShowCount,
      cancellationRate: rate(cancelledCount, total),
      noShowRate: rate(noShowCount, total),
    };
  }

  // -------------------------------------------------------------------------
  // Performance
  // -------------------------------------------------------------------------

  async getPerformance(range: DateRange): Promise<PerformanceOverview> {
    const [performance, campaigns] = await Promise.all([
      this.repo.performance(range),
      this.repo.campaignDeliveries(range),
    ]);

    return {
      conversations: performance.conversations,
      escalatedCount: performance.escalated,
      escalationRate: rate(performance.escalated, performance.conversations),
      responseTimeSeconds: performance.responseTimeSeconds,
      assigned: performance.assignedConversations,
      campaigns,
    };
  }

  // -------------------------------------------------------------------------
  // Forecasting
  // -------------------------------------------------------------------------

  /**
   * Weighted pipeline forecast: Σ openDeal.valueAmount × stage.winProbability,
   * decomposed per stage, plus a 3-month trailing-average projection of
   * collected revenue. The projection is explicitly labelled an estimate.
   */
  async getForecast(): Promise<ForecastOverview> {
    const [deals, monthly] = await Promise.all([
      this.repo.openDealsForForecast(),
      this.repo.collectedByMonth(6),
    ]);

    const byStageMap = new Map<
      string,
      { stageName: string; deals: number; value: number; weighted: number }
    >();
    for (const deal of deals) {
      const entry = byStageMap.get(deal.stageName) ?? {
        stageName: deal.stageName,
        deals: 0,
        value: 0,
        weighted: 0,
      };
      entry.deals += 1;
      entry.value += deal.valueAmount;
      entry.weighted += deal.valueAmount * deal.winProbability;
      byStageMap.set(deal.stageName, entry);
    }

    const weighted = deals.reduce(
      (sum, deal) => sum + deal.valueAmount * deal.winProbability,
      0,
    );
    const openValue = deals.reduce((sum, deal) => sum + deal.valueAmount, 0);

    // 3-month trailing average of collected revenue, projected 3 months out.
    const recent = monthly.slice(-3).map((row) => row.amount);
    const average =
      recent.length > 0
        ? recent.reduce((sum, amount) => sum + amount, 0) / recent.length
        : 0;

    const projection: { month: string; amount: number }[] = [];
    const cursor = new Date();
    cursor.setUTCDate(1);
    for (let i = 1; i <= 3; i += 1) {
      const next = new Date(cursor);
      next.setUTCMonth(next.getUTCMonth() + i);
      projection.push({
        month: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`,
        amount: Math.round(average),
      });
    }

    return {
      weighted,
      openValue,
      deals: deals.length,
      byStage: [...byStageMap.values()].sort((a, b) => b.weighted - a.weighted),
      projection,
      projectionIsEstimate: average > 0,
    };
  }
}
