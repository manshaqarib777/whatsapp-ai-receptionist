# Milestone 10 — CRM

Created: 2026-08-13
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 10`
Status: Approved 2026-08-13; re-certified 2026-08-23

---

## Objective

Build the CRM: pipelines, leads, companies, customers, tags, activities,
timeline, notes, tasks, and automation. The M4 schema already designed
`companies`, `pipelines`, `pipeline_stages`, `deals` (lead/deal in one table),
`tags`, `taggables`, and `activities`, plus the polymorphic `Activity`/`Taggable`
pattern. The M5 dashboard's `open leads` KPI and the M6 inbox's contact/tag
references become real, manageable surfaces.

True after this milestone, and not true now:

- Pipelines with ordered stages and win probability are manageable per branch;
  each org has a default pipeline.
- Deals (leads and deals in one table) move through stages with a persisted
  timeline; won/lost closes with `closedAt`.
- Companies are manageable and link to contacts and deals.
- Tags apply to contacts, deals, and conversations (polymorphic `taggables`),
  with a tag manager.
- Activities (note/call/email/meeting/stage change) form a timeline per subject,
  written through one `recordActivity` service.
- Tasks exist per org with assignee, due date, and status (the M5 `tasks` table
  gains its M10 surface).
- Automation: simple rule-based triggers (e.g. new lead → assign to stage, tag a
  company) evaluated in a worker.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits the
  CRM pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 10`:

```
CRM

Pipeline

Leads

Companies

Customers

Tags

Activities

Timeline

Notes

Tasks

Automation

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/crm/` feature domain

```
src/features/crm/
  repositories/crm.repository.ts      # only DB access; forScope everywhere
  services/crm.service.ts             # pure orchestration; deals, companies, tags, activities, tasks
  services/automation.ts              # rule evaluation (new lead, stage change, etc.)
  validators/crm.validators.ts        # zod schemas
  components/                         # pipeline board, deal drawer, company list, timeline, task list
  tests/crm.integration.test.ts       # real Postgres
  components/*.test.tsx               # axe-clean component tests
```

Repository bound to one tenant scope, every Prisma query through `forScope`.
The polymorphic `Activity`/`Taggable` tables are written through dedicated
service methods with a `CHECK`-restricted type, per the M4 deviation record.

### AD-2 — Deals: one table, lead/deal by stage

`deals` is the lead and the deal (M4 comment). A lead is a deal in the first
stage(s); moving stages and closing (`won`/`lost` + `closedAt`) is the CRM core.
Stage changes write an `Activity` (`stage_change`) and re-evaluate automation.

### AD-3 — Timeline + activities

Every mutation on a deal/company/contact records an `Activity` row through one
`recordActivity` method (kind, body, actor from the session). The timeline view
reads `activities` for a subject. Notes are activities of kind `note`.

### AD-4 — Tags

`taggables` polymorphic join. The tag manager CRUDs `tags`; tagging a subject
writes a `Taggable`. Re-tagging is idempotent (unique on
`(tagId, taggableType, taggableId)`).

### AD-5 — Automation

`services/automation.ts`: rule-based triggers evaluated in a DB-polled worker
(`src/workflows/crm-automation.worker.ts`), mirroring the knowledge/reminder
worker pattern (no Redis until M24). Rules in M10 scope:

- New deal in first stage → auto-assign to a configured assignee.
- Deal value ≥ threshold → add a tag.
- Company created → add a default tag.

Rules are org-scoped config; evaluation is idempotent (guarded by an activity
marker so re-runs don't double-apply).

### AD-6 — API routes (all `withApiHandler` + `requireOrg`/`requirePermission`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/crm/pipelines` | `crm:read` | Pipelines + stages |
| `POST /api/crm/pipelines` | `crm:write` | Create pipeline |
| `GET /api/crm/deals?stageId=&status=` | `crm:read` | Deals (board + list) |
| `POST /api/crm/deals` | `crm:write` | Create deal/lead |
| `PATCH /api/crm/deals/[id]` | `crm:write` | Move stage / update / close |
| `GET /api/crm/deals/[id]` | `crm:read` | Deal detail + timeline |
| `GET/POST /api/crm/companies` | `crm:read`/`crm:write` | Companies |
| `PATCH /api/crm/companies/[id]` | `crm:write` | Update company |
| `GET/POST /api/crm/tags` | `crm:read`/`crm:write` | Tags |
| `POST /api/crm/tags/[id]/assign` | `crm:write` | Tag a subject |
| `POST /api/crm/deals/[id]/activities` | `crm:write` | Add note/call/email/meeting |
| `GET /api/crm/deals/[id]/activities` | `crm:read` | Timeline |
| `GET/POST /api/crm/tasks` | `crm:read`/`crm:write` | Tasks |
| `PATCH /api/crm/tasks/[id]` | `crm:write` | Update/complete task |

`crm:read` / `crm:write` follow the house pattern (member+ write; viewer read).

---

## Dependencies

**New packages**: none — everything needed is already installed or in the M4
schema.

**Upstream**: 4 (schema), 6 (contacts), 9 (appointments reference contacts; the
CRM timeline may surface appointment activity), 8 (AI writes through the same
services where relevant).

---

## Database Impact

No new migration required — M4 created all seven tables plus the polymorphic
indexes and CHECK constraints. `tasks` already exists (M5).

**Seed**: `prisma/seed/crm.ts` already creates pipelines/stages/deals/companies/
tags/activities; it gains a task set and a cross-tenant beacon (org B deals never
visible to org A).

**Rollback**: no production data; `prisma migrate reset` + `db:deploy`.

---

## API Impact

See AD-6. New `/api/crm/*` routes only. Cross-tenant reads return 404 (house
rule).

---

## UI Impact

- `src/app/(app)/crm/` — pipeline board (`/crm`), deal detail drawer, companies
  (`/crm/companies`), tags manager, tasks (`/crm/tasks`).
- Components: `pipeline-board.tsx`, `deal-drawer.tsx`, `stage-column.tsx`,
  `company-list.tsx`, `company-drawer.tsx`, `tag-manager.tsx`, `timeline.tsx`,
  `task-list.tsx`, `crm-error.tsx`.
- Reuse: `DataTable`, `Badge`, `Button`, `Dialog`, `Sheet`, `Tabs`,
  `EmptyState`/`ErrorState`/`LoadingState`, `PageHeader`, `Timeline`.
- States: per-view loading skeleton, `ErrorState` with retry, `EmptyState`,
  populated. Keyboard-reachable rows; drag-and-drop stage moves degrade to
  buttons; axe-clean.

---

## AI Impact

The AI engine's tools gain `crm.lookup_company` / `crm.find_deal` (read tools)
so an inbound enquiry can resolve a company or deal context. No new prompts
beyond the tool descriptions.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; polymorphic rows stamped with org |
| Authorization | `crm:read/write` enforced server-side |
| PII | Deal/company/activity content never logged raw; activity bodies are customer data |
| Automation | Rule evaluation is idempotent and org-scoped; a misconfigured rule cannot cross tenants |

---

## Testing Strategy

- **Unit**: automation rule evaluation (assign/tag/close triggers + idempotency),
  activity recording, tag idempotency, stage-transition validation (cannot skip
  to closed without `closedAt`).
- **Integration** (real Postgres): pipeline CRUD + default pipeline, deal
  lifecycle with timeline rows, company links, tag assignment idempotency,
  task CRUD, automation triggers on new deal/stage change, **org A never sees
  org B's deals/companies/tasks**.
- **Component**: board/deal/company/tag/task/timeline states, axe-clean.
- **E2E**: seeded pipeline renders; move a deal's stage; create a company; tag a
  deal; complete a task; axe audits.
- **Seed**: extend `prisma/seed/crm.ts` with tasks + cross-tenant beacon.

**Exit gate**: typecheck (0), lint (0), `npm run test`, `npm run test:e2e`,
`npm run build`, drift check green, axe-clean CRM pages, docs + `CHANGELOG.md`
updated, `MILESTONE_10_COMPLETED.md` written.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Polymorphic tag/activity leak across tenants | Medium | Critical | Org stamp on every row + isolation integration test (org A never sees org B) |
| R-2 | Automation double-applies on re-run | Medium | Medium | Idempotency marker (activity guard); worker is at-least-once |
| R-3 | Stage move corrupts pipeline integrity | Low | High | Position/order validation; closed requires `closedAt`; transaction |
| R-4 | Scope creep into M11 (quotes) | Medium | Medium | Deals stay deal-shaped; quote generation is the next milestone |
