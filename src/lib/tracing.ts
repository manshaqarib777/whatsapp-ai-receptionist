import { randomBytes } from 'node:crypto';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export type RequestTrace = {
  traceId: string;
  spanId: string;
  sampled: boolean;
  traceparent: string;
};

export function requestTrace(header: string | null): RequestTrace {
  const match = header?.toLowerCase().match(TRACEPARENT);
  const incomingTraceId = match?.[1];
  const incomingSpanId = match?.[2];
  const validContext =
    incomingTraceId &&
    incomingSpanId &&
    !/^0+$/.test(incomingTraceId) &&
    !/^0+$/.test(incomingSpanId);
  const traceId = validContext ? incomingTraceId : randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');
  const sampled = Boolean(validContext && match?.[3] === '01');
  return {
    traceId,
    spanId,
    sampled,
    traceparent: `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`,
  };
}
