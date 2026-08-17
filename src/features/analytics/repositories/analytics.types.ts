/**
 * Analytics row types — Milestone 15.
 *
 * The analytics repository returns raw rows, counts, and sums; the service owns
 * the view model (buckets, deltas, conversion math, forecast decomposition).
 */

export type DateRange = { from: Date; to: Date };

/** A raw daily revenue point from the repository (invoiced or collected). */
export type RevenueSeriesPoint = { date: Date; amount: number };

/** One pipeline stage's deal aggregate for the funnel. */
export type FunnelStageRow = {
  stageName: string;
  position: number;
  winProbability: number;
  openDeals: number;
  openValue: number;
};

/** Quote → invoice → paid counts for the conversion funnel. */
export type ConversionFunnelRow = {
  quotes: number;
  quotesAccepted: number;
  quotesInvoiced: number;
  quotesPaid: number;
};

/** Contact lifecycle counts. */
export type LifecycleRow = { lifecycleStage: string; count: number };

/** Appointment status counts. */
export type AppointmentStatusRow = { status: string; count: number };

/** Conversation performance aggregates. */
export type PerformanceRow = {
  conversations: number;
  escalated: number;
  assignedConversations: { assigneeName: string; count: number }[];
  responseTimeSeconds: number | null;
};

/** Campaign delivery counts. */
export type CampaignDeliveryRow = { status: string; count: number };

/** Weighted forecast input: every open deal with its stage probability. */
export type ForecastDealRow = {
  dealId: string;
  name: string;
  valueAmount: number;
  stageName: string;
  winProbability: number;
};
