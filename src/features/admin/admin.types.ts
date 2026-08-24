export type PageInput = { page: number; limit: number };
export type AdminPage<T> = { items: T[]; page: number; limit: number; total: number };

export type PlanUpdate = {
  name?: string;
  description?: string;
  active?: boolean;
  version: number;
};
export type SubscriptionUpdate = {
  status?: 'trialing' | 'active' | 'past_due' | 'cancelled';
  cancelAtPeriodEnd?: boolean;
  planId?: string;
  version: number;
};
