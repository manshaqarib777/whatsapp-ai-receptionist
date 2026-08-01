import { createHash } from 'node:crypto';

import { createTransport, type Transporter } from 'nodemailer';

import { env, isProduction, isTest } from '@/lib/env';
import { UpstreamError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * Email port with three adapters, selected by EMAIL_TRANSPORT:
 *
 *   smtp       Real SMTP via nodemailer. Works with any provider — Resend,
 *              Postmark, SES, Gmail, or a corporate relay. Required in production.
 *   console    Writes the message to the terminal with the link on its own line.
 *              Zero setup, development only; env validation rejects it in
 *              production.
 *   in-memory  Tests. Assert the port was called with the right payload without
 *              opening a socket.
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
      { recipient: maskEmail(message.to), subject: message.subject },
      'email dispatched (console adapter)',
    );

    // The whole point of this adapter is that a developer can USE the link. Buried
    // inside a structured log line — wrapped, escaped, and surrounded by request
    // logs — it is technically present but practically invisible. Print it as a
    // delimited block with the URL on its own line, ready to click or copy.
    //
    // eslint-disable-next-line no-console -- deliberate developer-facing output
    console.log(
      [
        '',
        '  ┌─────────────────────────────────────────────────────────────',
        `  │ EMAIL (not sent — EMAIL_TRANSPORT=console)`,
        `  │ To:      ${maskEmail(message.to)}`,
        `  │ Subject: ${message.subject}`,
        '  ├─────────────────────────────────────────────────────────────',
        ...extractLinks(message.body).map((link) => `  │ ${link}`),
        '  └─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }
}

/** Pulls the actionable URLs out of a message body. */
function extractLinks(body: string): string[] {
  const links = body.match(/https?:\/\/\S+/g);

  return links && links.length > 0 ? links : ['(no link in this message)'];
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

/**
 * SMTP adapter — the real transport.
 *
 * Works against any SMTP server — Resend, Postmark, SES, Mailgun, Gmail, or a
 * corporate relay. Switching provider changes environment variables only.
 *
 * The transport is created lazily and reused. Nodemailer pools connections, so
 * constructing one per message would open a new TCP+TLS handshake every time.
 */
class SmtpEmailAdapter implements EmailPort {
  private transport: Transporter | null = null;

  private getTransport(): Transporter {
    if (this.transport) return this.transport;

    if (!env.SMTP_HOST) {
      // Unreachable in practice — env validation rejects this at boot — but the
      // type system does not know that.
      throw new Error('SMTP_HOST is not configured.');
    }

    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
      // A hung SMTP server must not hold a request open indefinitely.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      pool: true,
      maxConnections: 5,
    });

    return this.transport;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      const info = await this.getTransport().sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.body,
        html: toHtml(message.body),
      });

      logger.info(
        {
          recipient: maskEmail(message.to),
          subject: message.subject,
          messageId: info.messageId,
        },
        'email sent',
      );
    } catch (error) {
      // Log without the body — it carries single-use links, which are credentials.
      logger.error(
        { err: error, recipient: maskEmail(message.to), subject: message.subject },
        'email delivery failed',
      );

      throw new UpstreamError('Could not send email.', error);
    }
  }

  /** Verifies the connection. Used by the health check and by setup diagnostics. */
  async verify(): Promise<boolean> {
    try {
      await this.getTransport().verify();
      return true;
    } catch (error) {
      logger.warn({ err: error }, 'smtp verification failed');
      return false;
    }
  }
}

/**
 * Minimal HTML part.
 *
 * Deliberately plain: HTML mail is a rendering minefield across clients, and these
 * are transactional messages whose entire job is to deliver one link. A designed
 * template belongs in a later milestone, with the design system behind it.
 */
function toHtml(body: string): string {
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const linked = escaped.replace(
    /(https?:\/\/\S+)/g,
    '<a href="$1" style="color:#2563eb">$1</a>',
  );

  return [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;',
    'font-size:15px;line-height:1.6;color:#111;max-width:520px">',
    linked.replace(/\n/g, '<br>'),
    '</div>',
  ].join('');
}

/**
 * Masks an address for logging: `alex@example.com` → `a***@example.com#3f2a1b`.
 *
 * The six-character suffix is a truncated SHA-256 of the full address. It is not
 * reversible, so no PII is logged (SECURITY_RULES.md), but it is *stable* and
 * *distinguishing*: two different recipients produce different suffixes.
 *
 * Without it, `alex@gmail.com` and `alex+test@gmail.com` both render as
 * `a***@gmail.com`, which makes "did this go to the right person?" unanswerable
 * from the logs — a question that came up in practice.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[invalid]';

  const fingerprint = createHash('sha256').update(email).digest('hex').slice(0, 6);

  return `${local.slice(0, 1)}***@${domain}#${fingerprint}`;
}

/** Chooses the adapter from configuration. */
function createAdapter(): EmailPort {
  if (isTest) return new InMemoryEmailAdapter();

  return env.EMAIL_TRANSPORT === 'smtp'
    ? new SmtpEmailAdapter()
    : new ConsoleEmailAdapter();
}

if (isProduction && env.EMAIL_TRANSPORT !== 'smtp') {
  logger.warn(
    'EMAIL IS BEING DISCARDED: running a production build with EMAIL_TRANSPORT=console via E2E_TEST_RUN. No verification, reset, or invitation mail will be delivered.',
  );
}

let adapter: EmailPort = createAdapter();

/** Replaces the adapter. Used by tests and by setup diagnostics. */
export function setEmailAdapter(next: EmailPort): void {
  adapter = next;
}

export function currentTransport(): string {
  return isTest ? 'in-memory' : env.EMAIL_TRANSPORT;
}

/**
 * Verifies the SMTP connection, when SMTP is the configured transport.
 * Returns null when the transport is not SMTP, so callers can report "n/a".
 */
export async function verifyEmailTransport(): Promise<boolean | null> {
  if (!(adapter instanceof SmtpEmailAdapter)) return null;

  return adapter.verify();
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (isProduction && env.EMAIL_TRANSPORT !== 'smtp') {
    // Belt and braces: env validation already rejects this at boot. Silently
    // discarding a password-reset email is worse than a loud failure.
    throw new Error(
      'EMAIL_TRANSPORT must be "smtp" in production. Account-critical mail cannot be delivered.',
    );
  }

  if (isTest && !(adapter instanceof InMemoryEmailAdapter)) {
    // Guard against a test accidentally opening a real SMTP connection.
    adapter = new InMemoryEmailAdapter();
  }

  await adapter.send(message);
}

export const EMAIL_FROM = env.EMAIL_FROM;
