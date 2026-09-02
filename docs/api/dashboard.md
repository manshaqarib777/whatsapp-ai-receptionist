# Dashboard API

Milestone 5. Every route uses `withApiHandler` and therefore carries a correlation id,
structured logging, and the standard error envelope (`API_RULES.md`).

**Tenant scoping**: both routes read `organizationId` from the session row via
`requireOrg()`. No route accepts an organization id from the client. The dashboard
itself is server-rendered (`COMPONENT_DESIGN.md` §7) — these two routes exist only for
the two interactive pieces: persisting the date range and polling notifications.

---

## `PATCH /api/dashboard/range`

Persists the global dashboard date range in a cookie.

| | |
|---|---|
| **Auth** | Session with an active organization required (`requireOrg`) |
| **Authorization** | Any member |

**Request**
```json
{ "range": "30d" }
```
`range` is `"30d" | "90d"` (Zod-validated via `dashboardRangeSchema`, shared with the
`RangePicker`).

**200**
```json
{ "data": { "range": "30d" } }
```

Sets `dashboard:range` with `SameSite=Lax`, `httpOnly`, and a one-year max-age. The
cookie is a benign UI preference, never used for authorization — it is read server-side
by the dashboard page so the first paint already reflects the choice.

---

## `GET /api/dashboard/notifications`

The current user's notifications for the active organization.

| | |
|---|---|
| **Auth** | Session with an active organization required (`requireOrg`) |
| **Authorization** | The returned rows are filtered to the caller's user id |

**200**
```json
{
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "kind": "escalation",
        "title": "Conversation escalated to you",
        "body": "A customer is waiting.",
        "readAt": null,
        "createdAt": "2026-08-12T09:00:00.000Z"
      }
    ]
  }
}
```

Unread first (`readAt` NULLs first), then newest. Org-scoped via the scoped repository;
a user only ever sees rows for the active organization and their own user id.
