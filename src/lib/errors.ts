/**
 * Typed domain errors.
 *
 * Services throw these; the API handler wrapper (src/server/api-handler.ts) maps
 * them to status codes and the response envelope defined in .claude/API_RULES.md.
 * No service should ever construct an HTTP response itself.
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UNHEALTHY'
  | 'INTERNAL_ERROR';

export type ErrorDetail = {
  path: string;
  message: string;
};

/**
 * Base class for every error this application raises deliberately.
 *
 * `isOperational` distinguishes expected conditions (validation failed, not found)
 * from genuine bugs. Operational errors are logged at warn; everything else at
 * error, because it means something we did not anticipate.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options: { details?: ErrorDetail[]; cause?: unknown; isOperational?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request is invalid.', details?: ErrorDetail[]) {
    super('VALIDATION_FAILED', 400, message, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super('UNAUTHENTICATED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super('FORBIDDEN', 403, message);
  }
}

/**
 * Also used for cross-tenant access attempts. Per .claude/SECURITY_RULES.md we
 * return 404 rather than 403 so that existence is never confirmed across tenants.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super('NOT_FOUND', 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That conflicts with the current state.') {
    super('CONFLICT', 409, message);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'The request could not be processed.', details?: ErrorDetail[]) {
    super('UNPROCESSABLE', 422, message, { details });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests.') {
    super('RATE_LIMITED', 429, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'An upstream service failed.', cause?: unknown) {
    super('UPSTREAM_ERROR', 502, message, { cause });
  }
}

export class UnhealthyError extends AppError {
  constructor(message = 'Service is unhealthy.', details?: ErrorDetail[]) {
    super('UNHEALTHY', 503, message, { details });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Something went wrong.', cause?: unknown) {
    super('INTERNAL_ERROR', 500, message, { cause, isOperational: false });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
