import { env, isProduction, isTest } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Email port.
 *
 * No email provider is configured in Milestone 2 — one cannot be without credentials.
 * Rather than pretend, this defines the boundary the application depends on and ships
 * a console adapter for development.
 *
 * This is a deliberate, documented limitation (MILESTONE_02_PLAN.md, Risk 1), not a
 * mock standing in for a delivered feature. Wiring a real provider means implementing
 * one function.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development adapter: writes the message to the log so verification links, reset
 * links, and magic links are usable locally.
 *
 * Logs the subject and link but NOT the recipient in full — SECURITY_RULES.md forbids
 * logging full email addresses.
 */
class ConsoleEmailAdapter implements EmailPort {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      {
        recipient: maskEmail(message.to),
        subject: message.subject,
        // The body carries single-use links which are the point of the dev adapter.
        // Safe here because this adapter never runs in production (see sendEmail).
        preview: message.body,
      },
      'email dispatched (console adapter)',
    );
  }
}

/**
 * Test adapter: records messages in memory so tests can assert the port was called
 * with the right payload, without asserting that mail was delivered.
 */
export class InMemoryEmailAdapter implements EmailPort {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** Masks an address for logging: `alex@example.com` → `a***@example.com`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[invalid]';
  return `${local.slice(0, 1)}***@${domain}`;
}

let adapter: EmailPort = new ConsoleEmailAdapter();

/** Replaces the adapter. Used by tests and by future provider wiring. */
export function setEmailAdapter(next: EmailPort): void {
  adapter = next;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (isProduction) {
    // Fail loudly rather than silently dropping account-critical mail. A production
    // deployment without a provider must not appear to work.
    throw new Error(
      'No email provider is configured. Password resets, verification, and magic links cannot be delivered.',
    );
  }

  if (isTest && !(adapter instanceof InMemoryEmailAdapter)) {
    // Guard against a test accidentally exercising the console adapter.
    adapter = new InMemoryEmailAdapter();
  }

  await adapter.send(message);
}

export const EMAIL_FROM = env.EMAIL_FROM;
