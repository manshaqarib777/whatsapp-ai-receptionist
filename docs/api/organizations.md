# Organizations and Members API

Milestone 2. Every route uses `withApiHandler` and therefore carries a correlation id,
structured logging, and the standard error envelope (`API_RULES.md`).

**Tenant scoping**: every organization-scoped route reads `organizationId` from the
session row via `requireOrg()` / `requirePermission()`. No route accepts an
organization id from the client for scoping purposes.

---

## `GET /api/organizations`

Organizations the caller belongs to.

| | |
|---|---|
| **Auth** | Session required |
| **Authorization** | None beyond membership |

**200**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Dental",
      "slug": "acme-dental",
      "logo": null,
      "role": "owner",
      "memberCount": 4
    }
  ]
}
```

Returns only organizations the caller is a member of. Proven by
`tenant-isolation.integration.test.ts`.

---

## `POST /api/organizations`

Creates an organization; the caller becomes its `owner`.

| | |
|---|---|
| **Auth** | Session required |

**Request**
| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | 2–80 characters |
| `slug` | string | no | Lowercase, numbers, single hyphens. Derived from the name when omitted. |

**201** — the created organization, shaped as above.

The organization row and the owner membership are written in **one transaction**: an
organization with no owner would be unadministrable. A slug collision is resolved by
appending an incrementing suffix.

**Errors**: `VALIDATION_FAILED` 400, `UNAUTHENTICATED` 401, `CONFLICT` 409 (no unique
slug could be generated).

---

## `PATCH /api/organizations/active`

Switches the session's active organization.

| | |
|---|---|
| **Auth** | Session required |

**Request**
| Field | Type | Required |
|---|---|---|
| `organizationId` | uuid | yes |

**200** `{ "data": { "organizationId": "uuid", "role": "admin" } }`

**Membership is verified before the switch.** Without that check, any user could set
any organization id and read another tenant's data. A non-member receives **404**, not
403 — a 403 would confirm the organization exists.

Audited as `organization.switched`.

---

## `GET /api/members`

Members of the **active** organization.

| | |
|---|---|
| **Auth** | Session + active organization |
| **Permission** | `member:read` |

**200**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Alex Chen",
      "email": "alex@example.com",
      "image": null,
      "role": "admin",
      "createdAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

The organization is taken from the session, so there is no parameter through which
another tenant's members could be requested.

---

## `PATCH /api/members/:id`

Changes a member's role.

| | |
|---|---|
| **Auth** | Session + active organization |
| **Permission** | `member:update` |

**Request** — `{ "role": "owner" | "admin" | "member" | "viewer" }`

**200** — the updated member.

**Guards, in order**
1. The member must belong to the caller's organization → otherwise **404**, never 403.
2. `canAssignRole(actorRole, targetRole)` — only an owner may create another owner, so
   an admin cannot escalate themselves or anyone else.
3. The **last owner cannot be demoted** → 409. Otherwise the organization loses its only
   administrator.

Audited as `member.role_changed` with `previousRole` and `newRole` — ids and enums
only, never the member's name or email.

**Errors**: 400, 401, 403, 404, 409.

---

## `DELETE /api/members/:id`

Removes a member.

| | |
|---|---|
| **Auth** | Session + active organization |
| **Permission** | `member:remove` |

**200** `{ "data": { "id": "uuid" } }`

The **last owner cannot be removed** → 409. Cross-tenant member ids → 404.

Audited as `member.removed`.

---

## `GET /api/audit-logs`

Paginated audit trail for the active organization.

| | |
|---|---|
| **Auth** | Session + active organization |
| **Permission** | `audit:read` (owner and admin only) |

**Query**
| Parameter | Default | Notes |
|---|---|---|
| `limit` | 50 | Capped at 100 |
| `cursor` | — | Id of the last entry from the previous page |

**200**
```json
{
  "data": [
    {
      "id": "uuid",
      "action": "member.role_changed",
      "actorId": "uuid",
      "entityType": "member",
      "entityId": "uuid",
      "createdAt": "2026-08-01T00:00:00.000Z",
      "metadata": { "previousRole": "member", "newRole": "admin" }
    }
  ],
  "meta": { "nextCursor": "uuid", "hasMore": true }
}
```

Newest first, cursor-paginated, scoped to one organization.

**The log is append-only.** The service exposes no update or delete function, and the
table has no `updated_at` or `deleted_at` column. Metadata is sanitised before writing:
`email`, `name`, `phone`, `token`, and other PII keys are stripped even if a caller
passes them.

---

## Permission Matrix

`src/features/auth/permissions.ts` is authoritative; this is a summary.

| Permission | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| `organization:read` | ✓ | ✓ | ✓ | ✓ |
| `organization:update` | ✓ | ✓ | | |
| `organization:delete` | ✓ | | | |
| `organization:billing` | ✓ | | | |
| `member:read` | ✓ | ✓ | ✓ | ✓ |
| `member:invite` | ✓ | ✓ | | |
| `member:update` | ✓ | ✓ | | |
| `member:remove` | ✓ | ✓ | | |
| `audit:read` | ✓ | ✓ | | |
| `conversation:read` | ✓ | ✓ | ✓ | ✓ |
| `conversation:write` | ✓ | ✓ | ✓ | |
| `conversation:assign` | ✓ | ✓ | ✓ | |
| `conversation:delete` | ✓ | ✓ | | |
| `contact:read` | ✓ | ✓ | ✓ | ✓ |
| `contact:write` | ✓ | ✓ | ✓ | |
| `contact:delete` | ✓ | ✓ | | |
| `settings:read` | ✓ | ✓ | ✓ | ✓ |
| `settings:update` | ✓ | ✓ | | |

Conversation and contact permissions are declared now so that Milestones 6 and 10
extend this matrix rather than inventing a parallel one.

**Unknown roles are denied everything** — the model fails closed.
