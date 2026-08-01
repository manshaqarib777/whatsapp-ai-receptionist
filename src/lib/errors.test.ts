import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitError,
  UnauthenticatedError,
  UnhealthyError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
  isAppError,
} from '@/lib/errors';

/**
 * The status codes in .claude/API_RULES.md are a contract with every client.
 * These tests are what stops that contract drifting.
 */
describe('domain errors', () => {
  it.each([
    [new ValidationError(), 'VALIDATION_FAILED', 400],
    [new UnauthenticatedError(), 'UNAUTHENTICATED', 401],
    [new ForbiddenError(), 'FORBIDDEN', 403],
    [new NotFoundError(), 'NOT_FOUND', 404],
    [new ConflictError(), 'CONFLICT', 409],
    [new UnprocessableError(), 'UNPROCESSABLE', 422],
    [new RateLimitError(30), 'RATE_LIMITED', 429],
    [new InternalError(), 'INTERNAL_ERROR', 500],
    [new UpstreamError(), 'UPSTREAM_ERROR', 502],
    [new UnhealthyError(), 'UNHEALTHY', 503],
  ])('%s maps to its documented code and status', (error, code, status) => {
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });

  it('carries validation details per field', () => {
    const error = new ValidationError('Invalid', [
      { path: 'phoneNumber', message: 'Invalid E.164 format' },
    ]);

    expect(error.details).toEqual([
      { path: 'phoneNumber', message: 'Invalid E.164 format' },
    ]);
  });

  it('marks expected conditions as operational', () => {
    expect(new NotFoundError().isOperational).toBe(true);
    expect(new ValidationError().isOperational).toBe(true);
  });

  it('marks an internal error as non-operational so it is logged as a bug', () => {
    expect(new InternalError().isOperational).toBe(false);
  });

  it('preserves the cause for logging', () => {
    const cause = new Error('socket hang up');
    expect(new UpstreamError('Upstream failed', cause).cause).toBe(cause);
  });

  it('exposes retry-after seconds on a rate limit error', () => {
    expect(new RateLimitError(45).retryAfterSeconds).toBe(45);
  });

  it('sets the error name to the concrete subclass', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('identifies application errors and rejects foreign ones', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new AppError('INTERNAL_ERROR', 500, 'x'))).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('a string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it('does not expose internal detail in the default client-facing messages', () => {
    // These strings are shown to end users; they must stay generic.
    expect(new InternalError().message).toBe('Something went wrong.');
    expect(new NotFoundError().message).toBe('Not found.');
  });
});
