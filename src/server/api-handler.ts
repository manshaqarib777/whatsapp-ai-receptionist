import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  type AppError,
  InternalError,
  RateLimitError,
  ValidationError,
  isAppError,
  type ErrorDetail,
} from '@/lib/errors';
import { requestLogger } from '@/lib/logger';

/**
 * The single error-handling boundary for every API route.
 *
 * Every route handler is wrapped in this. It guarantees the four things
 * .claude/API_RULES.md requires of every response: a correlation id, structured
 * logging, a consistent envelope, and no leaked internals. Routes never
 * construct an error response themselves.
 */

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
};

export type RouteContext = {
  correlationId: string;
  logger: ReturnType<typeof requestLogger>;
};

type Handler = (request: Request, context: RouteContext) => Promise<NextResponse>;

/**
 * Converts a Zod error into our error-detail shape so validation failures are
 * reported per-field rather than as one opaque string.
 */
function zodToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

function normaliseError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError('The request is invalid.', zodToDetails(error));
  }

  // Anything reaching here is unanticipated. Preserve the cause for the logs, but
  // the client only ever sees the generic message.
  return new InternalError('Something went wrong.', error);
}

export function jsonSuccess<T>(
  data: T,
  init: { status?: number; meta?: Record<string, unknown>; correlationId: string },
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = init.meta ? { data, meta: init.meta } : { data };

  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { [CORRELATION_ID_HEADER]: init.correlationId },
  });
}

export function jsonError(
  error: AppError,
  correlationId: string,
): NextResponse<ApiError> {
  const headers: Record<string, string> = {
    [CORRELATION_ID_HEADER]: correlationId,
  };

  if (error instanceof RateLimitError) {
    headers['Retry-After'] = String(error.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status, headers },
  );
}

/**
 * Wraps a route handler with correlation id, structured logging, timing, and
 * error mapping.
 *
 * @param routeName Stable identifier used in logs, e.g. "GET /api/health".
 * @param handler   The route implementation.
 */
export function withApiHandler(routeName: string, handler: Handler) {
  return async function wrapped(request: Request): Promise<NextResponse> {
    const correlationId = request.headers.get(CORRELATION_ID_HEADER) ?? randomUUID();

    const log = requestLogger({
      correlationId,
      route: routeName,
      method: request.method,
    });

    const startedAt = performance.now();

    try {
      const response = await handler(request, { correlationId, logger: log });

      log.info(
        {
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        },
        'request completed',
      );

      response.headers.set(CORRELATION_ID_HEADER, correlationId);
      return response;
    } catch (error) {
      const appError = normaliseError(error);
      const durationMs = Math.round(performance.now() - startedAt);

      // Operational errors are expected conditions, not incidents. Genuine bugs
      // are logged at error with the stack so they surface in alerting.
      if (appError.isOperational) {
        log.warn(
          { status: appError.status, code: appError.code, durationMs },
          appError.message,
        );
      } else {
        log.error(
          { status: appError.status, code: appError.code, durationMs, err: appError },
          'unhandled error',
        );
      }

      return jsonError(appError, correlationId);
    }
  };
}
