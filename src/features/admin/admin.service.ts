import { adminRepository } from '@/lib/db/admin.repository';
import type { PageInput, PlanUpdate, SubscriptionUpdate } from './admin.types';

export const adminService = {
  overview: () => adminRepository.overview(),
  tenants: (input: PageInput) => adminRepository.tenants(input),
  plans: () => adminRepository.plans(),
  updatePlan: (id: string, input: PlanUpdate) => adminRepository.updatePlan(id, input),
  billing: (input: PageInput) => adminRepository.billing(input),
  updateSubscription: (id: string, input: SubscriptionUpdate) =>
    adminRepository.updateSubscription(id, input),
  logs: (input: PageInput) => adminRepository.logs(input),
  aiUsage: () => adminRepository.aiUsage(),
  analytics: () => adminRepository.analytics(),
  monitoring: () => adminRepository.monitoring(),
};
