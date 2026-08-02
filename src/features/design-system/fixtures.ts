import type { ChartConfig } from '@/components/ui/chart';

/**
 * Gallery fixtures.
 *
 * Shaped like real product data (conversations, resolutions, customers) rather than
 * "Lorem ipsum" or `foo/bar`, because a component only reveals its layout problems
 * under plausible content — long names, four-digit counts, a status that wraps.
 */

export const CHART_DATA = [
  { date: 'Mon', conversations: 42, resolved: 30 },
  { date: 'Tue', conversations: 58, resolved: 41 },
  { date: 'Wed', conversations: 51, resolved: 39 },
  { date: 'Thu', conversations: 73, resolved: 58 },
  { date: 'Fri', conversations: 88, resolved: 71 },
  { date: 'Sat', conversations: 34, resolved: 28 },
  { date: 'Sun', conversations: 21, resolved: 18 },
];

export const CHART_CONFIG = {
  conversations: { label: 'Conversations', color: 'var(--chart-1)' },
  resolved: { label: 'Resolved', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export type CustomerRow = {
  id: string;
  customer: string;
  status: string;
  value: number;
};

export const TABLE_DATA: CustomerRow[] = [
  { id: '1', customer: 'Acme Dental', status: 'Active', value: 1240 },
  { id: '2', customer: 'Globex Clinic', status: 'Pending', value: 880 },
  { id: '3', customer: 'Initech Health', status: 'Active', value: 2310 },
];
