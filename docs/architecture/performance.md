# Performance architecture

Milestone 24 improves repeat-read latency and large-list rendering while preserving
the nonce-based content security policy and every authorization boundary.

## Redis and graceful fallback

`src/lib/redis.ts` owns one lazily connected official Redis client. Redis is optional:
ordinary reads bypass the cache after connection/runtime errors, while rate limiting
falls back to the durable PostgreSQL bucket implementation. A Redis outage therefore
reduces performance but never disables authorization or abuse controls.

Local Docker uses Redis 8 with a 128 MiB `allkeys-lru` ceiling, no persistence, and a
loopback-only port. Production should use an authenticated private endpoint and TLS
where the provider supports it.

## Cache boundary

Only fixed aggregate DTOs may use `cacheGetOrLoad`. Cache keys contain an HMAC digest
of the organization id plus a versioned namespace; raw tenant ids do not appear in
Redis. TTL defaults to 30 seconds and affected namespaces are explicitly invalidated
after mutations.

The following are never cached: sessions, permissions, authorization decisions,
credentials, privacy exports, contact PII, and message bodies. Cache failure is a
performance event, not a reason to weaken access control.

## Rendering

The root remains request-rendered because each response carries a fresh CSP nonce.
Route-level `loading.tsx` supplies a streamed Suspense fallback. Large inbox result
sets render a fixed-height, overscanned window while retaining a semantic list,
`aria-setsize`, and `aria-posinset`; small sets render normally.

Next.js automatically splits Server Components by route. The interaction-heavy
workflow graph is additionally loaded through a Client Component `next/dynamic`
boundary, so its editor hooks and controls do not enter the initial application shell.
Server-only document parsing/OCR libraries remain worker-bound and load on demand.

## Enforced budgets

`npm run performance:check` inspects production build assets and fails if any
JavaScript chunk exceeds 500 KiB or any CSS asset exceeds 150 KiB. The check runs
after `npm run build`; tests cover the budget evaluator independently of build output.
