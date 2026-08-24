import { signInSecurityRepository } from '@/lib/db/auth/sign-in-security.repository';
import * as auditLog from '@/features/auth/services/audit-log.service';

const LOCK_STEPS_SECONDS = [0, 0, 0, 0, 60, 5 * 60, 15 * 60, 60 * 60] as const;

export async function getSignInState(email: string) {
  return signInSecurityRepository.findByEmail(email.trim().toLowerCase());
}

export function isLocked(state: { lockedUntil: Date | null } | null, now = new Date()) {
  return Boolean(state?.lockedUntil && state.lockedUntil > now);
}

export function lockDurationSeconds(failedLoginAttempts: number): number {
  const index = Math.min(
    Math.max(failedLoginAttempts - 1, 0),
    LOCK_STEPS_SECONDS.length - 1,
  );
  return LOCK_STEPS_SECONDS[index] ?? 0;
}

export async function recordFailedSignIn(
  state: { id: string; failedLoginAttempts: number } | null,
  request: Request,
): Promise<void> {
  if (!state) return;
  const attempts = state.failedLoginAttempts + 1;
  const seconds = lockDurationSeconds(attempts);
  const lockedUntil = seconds > 0 ? new Date(Date.now() + seconds * 1_000) : null;
  await signInSecurityRepository.recordFailure(state.id, attempts, lockedUntil);
  await auditLog.record({
    action: 'auth.sign_in_failed',
    actorId: state.id,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
    metadata: { attempts, locked: lockedUntil !== null },
  });
}

export async function recordSuccessfulSignIn(userId: string, request: Request) {
  await signInSecurityRepository.clearFailures(userId);
  await auditLog.record({
    action: 'auth.sign_in',
    actorId: userId,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  });
}
