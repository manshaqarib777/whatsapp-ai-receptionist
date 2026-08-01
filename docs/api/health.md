# Health API

## `GET /api/health`

Liveness and dependency check.

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

### Response — 200

```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-08-01T00:00:00.000Z",
    "uptimeSeconds": 42,
    "checks": {
      "database": "ok"
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

**Response headers**

| Header | Notes |
|---|---|
| `x-correlation-id` | Always present |

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
- The check never throws; it resolves to `"error"` and the route maps that to 503.

### Security

The response deliberately contains **no** version numbers, hostnames, dependency
lists, connection strings, or error internals. Those are reconnaissance for an
attacker, and an unauthenticated endpoint is exactly where they must not appear.
This is covered by an integration test that asserts the body contains no connection
string, credential, port, ORM name, or stack trace.

### Known Limitations

- **No rate limiting.** Redis arrives in Milestone 24. Until then this endpoint can be
  polled without restriction. It performs one trivial query, so the exposure is
  limited, but it is a real gap and is tracked in `MILESTONE_01_COMPLETED.md`.

### Implementation

| Layer | File |
|---|---|
| Controller | `src/app/api/health/route.ts` |
| Service | `src/features/health/services/health.service.ts` |
| Wrapper | `src/server/api-handler.ts` |
| Hook | `src/features/health/hooks/use-health.ts` |
| Tests | `src/features/health/tests/health.integration.test.ts` |
