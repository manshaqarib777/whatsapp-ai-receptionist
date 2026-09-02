# Observability and alerting

## Signals

- Health: `/api/health/live` proves the process event loop can answer; `/api/health/ready`
  verifies PostgreSQL and configured Redis before an instance receives traffic.
- Logs: production writes newline-delimited Pino JSON. Central redaction removes secrets,
  authorization/cookies, phone numbers, message bodies, and content fields.
- Traces: every API response carries W3C `traceparent`. Valid incoming trace IDs continue
  with a fresh server span; invalid context is replaced. Logs include `traceId`, `spanId`,
  `correlationId`, route, method, status, and duration, but never baggage or customer data.
- Business monitoring: the separately authorized admin monitoring surface reports safe
  tenant/job/system aggregates without customer content.

## Minimum alerts

Configure these in the hosting provider from readiness probes and structured logs. Each
alert must link to this runbook and identify the immutable deployment digest.

| Alert | Trigger | Window | First action |
|---|---|---:|---|
| Readiness unavailable | >2 consecutive failed probes or >1% fleet unready | 2 min | Stop rollout; inspect dependency status |
| Server error ratio | non-operational 5xx >2% of requests | 5 min | Correlate by trace/deployment ID |
| API latency | p95 >2 s or p99 >5 s | 10 min | Compare route and dependency spans |
| Worker backlog | oldest queued job >5 min | 5 min | Check worker health/capacity; do not replay blindly |
| Database saturation | pool wait or connection use >80% | 10 min | Reduce rollout/concurrency; inspect slow queries |
| Redis unavailable | configured Redis readiness error | 2 min | Confirm PostgreSQL limiter fallback load |

## Incident runbook

1. Acknowledge the alert and record its time, deployment digest, region, and trace IDs.
2. Check liveness, readiness, database, Redis, and worker backlog without logging payloads.
3. If the issue began with a rollout, halt promotion and follow `deployment.md` rollback.
4. Preserve logs and audit records. Never paste credentials, message bodies, exports, or
   raw database rows into the incident channel.
5. Restore service, verify readiness and one synthetic read-only journey, then write a
   blameless incident review with detection and prevention actions.
