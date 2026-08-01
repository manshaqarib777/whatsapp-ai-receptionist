import pino, { type Logger } from 'pino';

import { env, isDevelopment, isTest } from '@/lib/env';

/**
 * Structured logging.
 *
 * Redaction is configured HERE rather than at each call site. Per
 * .claude/SECURITY_RULES.md, a careless call site must fail safe: if someone logs a
 * whole request object, the sensitive paths are stripped by the logger instead of
 * relying on every developer remembering.
 *
 * Message bodies and phone numbers are customer PII and must never be logged. Log
 * the message id and look it up instead.
 */

const REDACTED_PATHS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'phone',
  'phoneNumber',
  'body',
  'message',
  'content',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.phone',
  '*.phoneNumber',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

export const logger: Logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  // Pretty output locally; newline-delimited JSON everywhere else so log
  // aggregators can parse it.
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Creates a child logger bound to a correlation id (and any other request-scoped
 * context). Every log line from a single request is then traceable.
 */
export function requestLogger(context: {
  correlationId: string;
  route?: string;
  method?: string;
}): Logger {
  return logger.child(context);
}

export const REDACTED_PATHS_FOR_TEST = REDACTED_PATHS;
