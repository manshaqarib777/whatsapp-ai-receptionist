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
