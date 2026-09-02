# Health API

## `GET /api/health`

Backward-compatible aggregate dependency health check. Infrastructure should use the
dedicated liveness and readiness endpoints below.

| Aspect | Value |
|---|---|
| **Auth** | None |
| **Authorization** | Not applicable |
| **Rate limit** | None (see Known Limitations) |
| **Caching** | Never cached (`dynamic = 'force-dynamic'`, `revalidate = 0`) |
| **Milestone** | 1 |

### Why this endpoint is unauthenticated

It must be reachable by an uptime probe, and it exists before any authentication
system does (Milestone 2). It exposes no data — deliberately. See *Security* below.

### Request

No parameters, body, or required headers.

| Header | Required | Purpose |
|---|---|---|
| `x-correlation-id` | no | Echoed back if supplied, so traces join across services. Generated when absent. |
| `traceparent` | no | Valid W3C trace context. Invalid or all-zero values are replaced safely. |

### Response — 200

```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-08-01T00:00:00.000Z",
    "uptimeSeconds": 42,
    "checks": {
      "database": "ok",
      "email": "not-configured",
      "redis": "ok"
    }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | `"ok" \| "degraded"` | Overall state |
| `timestamp` | ISO 8601 string | Time of the check |
| `uptimeSeconds` | number | Process uptime, whole seconds |
| `checks.database` | `"ok" \| "error"` | Postgres reachability |
| `checks.email` | `"ok" \| "not-configured"` | Local delivery configuration; no external SMTP call |
| `checks.redis` | `"ok" \| "error" \| "not-configured"` | Optional Redis reachability; never exposes its address |

**Response headers**

| Header | Notes |
|---|---|
| `x-correlation-id` | Always present |
| `traceparent` | Always present; continues a valid trace ID with a fresh server span |

### Response — 503

Returned when any dependency check fails.

```json
{
  "error": {
    "code": "UNHEALTHY",
    "message": "One or more dependencies are unavailable.",
    "details": [
      { "path": "checks.database", "message": "database is error" }
    ]
  }
}
```

### Errors

| Code | Status | Cause |
|---|---|---|
| `UNHEALTHY` | 503 | A dependency check failed |
| `INTERNAL_ERROR` | 500 | Unexpected failure inside the handler |

### Behaviour

- The database check is a `SELECT 1` with a **2 second timeout**. A hung database
  cannot hold the health check open — an uptime probe that never returns is worse
  than one that fails.
- Redis is optional. When `REDIS_URL` is configured, the check issues a bounded
  `PING`; otherwise its state is `"not-configured"` and the application uses its
  PostgreSQL/direct-read fallbacks.
- Email reports configuration only and never contacts an external provider.
- The check never throws; it resolves to `"error"` and the route maps that to 503.

### Security

The response deliberately contains **no** version numbers, hostnames, dependency
lists, connection strings, or error internals. Those are reconnaissance for an
attacker, and an unauthenticated endpoint is exactly where they must not appear.
This is covered by an integration test that asserts the body contains no connection
string, credential, port, ORM name, or stack trace.

### Operational boundary

The endpoint is intentionally not application-rate-limited so infrastructure probes
cannot consume a shared tenant/user bucket. Operators should apply probe-specific
limits at the private ingress or load balancer.

### Implementation

| Layer | File |
|---|---|
| Controller | `src/app/api/health/route.ts` |
| Service | `src/features/health/services/health.service.ts` |
| Wrapper | `src/server/api-handler.ts` |
| Hook | `src/features/health/hooks/use-health.ts` |
| Tests | `src/features/health/tests/health.integration.test.ts` |

## `GET /api/health/live`

Process liveness probe. It performs no dependency I/O and returns `200` with
`{"data":{"status":"ok"}}` while the application can serve requests. A platform should
restart the instance only when this probe fails.

## `GET /api/health/ready`

Traffic readiness probe. It applies the same bounded PostgreSQL and configured-Redis
checks as the aggregate endpoint, returning `200` with status `ready` or `503` with code
`UNHEALTHY`. A platform should remove an instance from routing while this probe fails,
without treating a transient dependency outage as proof that the process is dead.

Both dedicated probes are unauthenticated, never cached, expose no infrastructure
addresses, and return `x-correlation-id` and `traceparent` response headers.
