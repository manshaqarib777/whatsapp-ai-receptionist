# Milestone 24 — Performance

## Objective

Improve multi-instance latency and scalability with Redis-backed ephemeral state,
bounded caches, deliberate code-splitting/lazy-loading, streamed route fallbacks,
virtualized high-volume lists, and enforceable performance budgets without weakening
tenant isolation or the Milestone 23 nonce policy.

## Requirements

Performance

Caching

Redis

Lazy Loading

Code Splitting

Streaming

Virtualization

Optimization

STOP

## Architecture Decisions

- Add Redis as optional local/production infrastructure behind one typed adapter. Use
  it for durable rate-limit buckets and short-lived, namespaced cache entries; fail
  over to PostgreSQL throttling and direct reads when Redis is unavailable.
- Cache only fixed aggregate DTOs with tenant-aware keys and short TTLs. Never cache
  sessions, permissions, credentials, PII exports, message bodies, or authorization
  decisions. Mutations explicitly invalidate affected namespaces.
- Preserve request-time rendering for CSP nonces, using Suspense streaming rather than
  reverting security to regain static output.
- Lazy-load genuinely heavy client surfaces already isolated by interaction (editor,
  charts/PDF where applicable) and enforce route chunk budgets from build artifacts.
- Window high-volume conversation/activity tables while keeping accessible item counts,
  keyboard reachability, and deterministic fallback behavior.

## Dependencies

- Upstream: Milestones 1–23.
- Add the official maintained `redis` Node client. Redis 8 local container, healthcheck,
  bounded memory, and no externally exposed port. No queue migration in this milestone.

## Data and API Impact

- No business-schema tables. The PostgreSQL limiter remains a failover path.
- Add `REDIS_URL`, cache TTL/prefix configuration, health status, and safe performance
  diagnostics. No cache keys or infrastructure URLs reach clients/logs.

## Security Considerations

- Every tenant cache key contains an HMAC tenant digest, not a raw organization id.
- Cache misses/errors fail open only for performance, never for authorization; rate
  limiting fails over to PostgreSQL rather than allowing requests.
- Redis is private, authenticated in production, TLS where provider-supported, and
  stores no credentials or customer content.

## Testing Strategy

- Unit: cache serialization, tenant keying, TTL, invalidation, Redis failure behavior,
  virtual window math, performance-budget parser.
- Integration: real local Redis rate-limit atomicity/cache TTL and PostgreSQL failover.
- Component/E2E: large-list windowing, loading/streaming states, accessibility, mobile,
  unchanged feature workflows.
- Full gates plus production bundle-size budget and measured critical-route response.

## Risks

1. **Cross-tenant cache collision** — critical; keyed tenant digest and isolation tests.
2. **Redis outage bypasses abuse control** — critical; PostgreSQL failover.
3. **Stale commercial/security data** — high; never cache auth/security, short aggregate
   TTLs, explicit mutation invalidation.
4. **Virtualization harms accessibility** — high; semantic totals, overscan, keyboard and
   screen-reader tests.
5. **Nonce rendering performance regression** — medium; keep security and stream/cache
   server data rather than restoring static scripts.
