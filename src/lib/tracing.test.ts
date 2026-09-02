import { describe, expect, it } from 'vitest';
import { requestTrace } from '@/lib/tracing';

describe('W3C request tracing', () => {
  it('continues a valid trace with a fresh server span', () => {
    const trace = requestTrace('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(trace.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(trace.sampled).toBe(true);
    expect(trace.traceparent).toMatch(/^00-.{32}-.{16}-01$/);
  });

  it.each([null, 'invalid', '00-00000000000000000000000000000000-0000000000000000-01'])(
    'replaces invalid or absent context: %s',
    (header) => {
      const trace = requestTrace(header);
      expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(trace.traceId).not.toMatch(/^0+$/);
      expect(trace.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/);
    },
  );
});
