import { AnalyticsRepository } from '@/features/analytics/repositories/analytics.repository';
import type { DateRange } from '@/features/analytics/repositories/analytics.types';
import { fillDailySeries, formatShortDate, rate } from './analytics-math';
import type {
  BookingsOverview,
  ConversionRates,
  ForecastOverview,
  FunnelSection,
  PerformanceOverview,
  RetentionOverview,
  RevenueOverview,
} from './analytics.view-models';

export * from './analytics-math';
export type * from './analytics.view-models';

/**
 * Analytics view model — Milestone 15.
 *
 * Pure orchestration over the repository: converts raw rows into the shapes the
 * sections render and owns the math that is unit-testable without a database —
 * deltas, conversion rates, the weighted forecast, and the trailing-average
 * projection. No SQL here; the repository is the only DB-touching layer.
 */

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

  async getConversion(range?: DateRange): Promise<ConversionRates> {
    const [funnel, won, lost] = await Promise.all([
      this.repo.conversionFunnel(range),
      this.repo.dealCountByStatus('won', range),
      this.repo.dealCountByStatus('lost', range),
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
