import { RateLimitError } from '@/lib/errors';
import { consumeDurable } from '@/lib/rate-limit';
import { requirePlatformAdmin } from '@/server/auth-context';

export async function requireAdminRequest() {
  const context = await requirePlatformAdmin();
  const allowance = await consumeDurable('api', `platform-admin:${context.user.id}`);
  if (!allowance.allowed) throw new RateLimitError(allowance.retryAfterSeconds);
  return context;
}
