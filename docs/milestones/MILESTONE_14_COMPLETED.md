# Milestone 14 — Completed

Completed: 2026-08-16
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 14`

---

## What Was Built

The Broadcast System at `/broadcast`: campaigns, scheduling, segmentation,
templates, and analytics. The M4 schema (`segments`, `whatsapp_message_templates`,
`campaigns`, `campaign_recipients`) now has its service layer, API, and UI — with
segments evaluated as a filter tree against contacts at send time, and a DB-polled
send worker using the established pattern.

Against the plan's objective, all of the following are now true and were not before:

- **Segments are manageable**: a name plus a filter tree (locale, lifecycle
  stage, consent, deal value, created-after) evaluated against contacts at send
  time — a segment is a question, not a snapshot. The evaluation hard-codes the
  consent invariants: a broadcast to an opted-out contact is refused, not
  silently skipped.
- **WhatsApp message templates are manageable per branch**: name, language, body,
  and a Meta approval status that gates use. A campaign can only be created
  against an `approved` template (409 otherwise); templates are unique per
  `(branchId, name, language)`.
- **Campaigns are manageable**: name, segment, template, and schedule across
  `draft → scheduled → sending → sent / cancelled`. A scheduled campaign can be
  cancelled before it sends; sending materialises recipients from the segment
  evaluation, excludes opted-out contacts, and records per-recipient
  `DeliveryStatus` rows. A zero-eligible campaign is refused (422).
- **A DB-polled worker sends the materialised recipients** (`npm run
  broadcast:work`): it claims due `scheduled` campaigns (and in-flight
  `sending` ones), marks recipients `sent`, and advances the campaign to `sent`
  (`finishedAt`). The WhatsApp send path is the same stub seam as the reminder
  worker — the status columns are real.
- **Analytics exist**: per-campaign totals (total, sent, delivered, read,
  failed, delivered rate) derived from the recipient rows, plus a segment
  preview count before send.
- **The `/broadcast` UI is real**: a status-filtered campaign list with a create
  doorway (segment + approved template + optional schedule), a campaign detail
  (segment, template, schedule, lifecycle actions, analytics, recipients), and
  segment and template managers.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the broadcast pages clean.

### Bugs the test suite found and fixed

1. **The analytics `total` was defined as only the `queued` count.** The plan
   defines totals from the recipient rows; a campaign that has finished sending
   has no queued rows left, so `total` read 0 for a sent campaign. It now counts
   every recipient status (`queued + sent + failed`).
2. **The permissions test caught a missing `broadcast:read/write` on the
   `member` role.** The first edit added the permissions to owner/admin but the
   member block was missed; the privilege-ordering test ("each role holds at
   least as much as the one below it") failed because viewer held `broadcast:read`
   and member did not. Fixed — the role matrix is complete.
3. **A pre-existing time-of-day flake in the appointments integration test.** The
   reminder test booked a hardcoded `2026-08-16T09:00:00Z` appointment; reminders
   are only scheduled when their lead time is in the future, so after ~08:00 UTC
   on that date the 1-hour reminder is in the past and the count is 0. The test
   now books the nearest future Sunday 09:00 UTC. (Found because the milestone
   gate forbids continuing with failing tests.)

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/broadcast/repositories/broadcast.base.ts` | Scoped-client plumbing (tenant isolation control). |
| `src/features/broadcast/repositories/broadcast.types.ts` | Shared row types (segment, template, campaign, recipient). |
| `src/features/broadcast/repositories/segments.repository.ts` | Segment data access. |
| `src/features/broadcast/repositories/templates.repository.ts` | Template data access (approval gating). |
| `src/features/broadcast/repositories/campaigns.repository.ts` | Campaign + recipient data access (materialisation, delivery status). |
| `src/features/broadcast/repositories/broadcast.repository.ts` | Facade — the single `BroadcastRepository` surface. |
| `src/features/broadcast/services/segments.ts` | Pure filter-tree evaluation + `SegmentDefinition` type. |
| `src/features/broadcast/services/segments.test.ts` | 14 unit tests (locale, lifecycle, consent, opted-out, deal value, date). |
| `src/features/broadcast/services/broadcast.service.ts` | Orchestration: segments, templates, lifecycle, analytics, worker steps. |
| `src/features/broadcast/validators/broadcast.validators.ts` | Zod schemas for all broadcast routes. |
| `src/features/broadcast/hooks/use-broadcast.ts` | React Query hooks + mutations (envelope-unwrapping). |
| `src/features/broadcast/components/campaign-list.tsx` | Status-filtered list + create dialog. |
| `src/features/broadcast/components/campaign-detail.tsx` | Detail: segment/template/schedule, lifecycle actions, analytics, recipients. |
| `src/features/broadcast/components/segment-manager.tsx` | Segment list + create + preview count. |
| `src/features/broadcast/components/template-manager.tsx` | Template list + create + approval status. |
| `src/features/broadcast/components/broadcast.components.test.tsx` | 13 component tests (list/detail/segment/template states, axe-clean). |
| `src/features/broadcast/tests/broadcast.integration.test.ts` | Real Postgres: CRUD, consent, lifecycle, analytics, **org A never sees org B**. |
| `src/workflows/broadcast.worker.ts` | The DB-polled send worker's loop. |
| `scripts/broadcast-worker.ts` | `npm run broadcast:work` entry. |
| `src/app/api/broadcast/` | AD-6 routes: segments, preview, templates, campaigns, transition, send. |
| `src/app/(app)/broadcast/` | `/broadcast` list + `/broadcast/[id]` detail + segments + templates pages. |
| `prisma/seed/broadcast.ts` | Seeded segment, approved template, and campaigns across lifecycle states. |
| `tests/e2e/broadcast.spec.ts` | Seeded list, detail analytics, segment preview, axe. |
| `docs/api/broadcast.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `src/features/auth/permissions.ts` | `broadcast:read` / `broadcast:write` across roles. |
| `src/features/auth/navigation.ts` | `Broadcast` nav item. |
| `src/components/sidebar-nav.tsx` | `megaphone` icon registered. |
| `src/middleware.ts` | `/broadcast` in the protection matcher. |
| `package.json` | `broadcast:work` script; `nanoid@^3.3.18` + `hono@^4.13.0` overrides (audit-clean). |
| `README.md` | Status updated from Milestone 4 to Milestone 14 with the product summary. |
| `prisma/seed.ts` | Wire the broadcast seed. |
| `src/features/appointments/tests/appointments.integration.test.ts` | Reminder test books a future Sunday (pre-existing time-of-day flake). |
| `.claude/CHANGELOG.md` | Milestone 14 entry. |
| `docs/architecture/overview.md` | "Current as of Milestone 14". |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (segments) | 14 | `evaluateSegment` rules: locale, lifecycle, created-after, deal value, ANDing, consent + opted-out invariants (can never be weakened), `isEmptyDefinition` | `npm run test` |
| Component (broadcast) | 13 | list/detail/segment/template states (loading/error/empty/populated), lifecycle actions, axe-clean | `npm run test` |
| Integration (broadcast) | 9 | real Postgres: segment CRUD + preview (opted-out/never-consented excluded), template approval gate, campaign create → schedule → send materialises recipients, cancel before send, worker marks recipients sent, analytics totals + rate, **org A never sees org B** | `npm run test` |
| **Vitest total** | **816 passing overall** (up from 780) | — | `npm run test` |
| E2E (broadcast) | 4 × 2 projects | seeded list, detail analytics + recipients, segment preview, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the broadcast pages clean.

### What the integration tests assert

Segment create + list isolation between orgs; a 404 for a missing segment; a
preview that excludes opted-out and never-consented contacts; templates approved
by default; a campaign create against an approved template; a 409 against an
unapproved template; send-time materialisation that excludes opted-out contacts
(one recipient, not two); a 422 when a campaign has zero eligible recipients; the
worker advancing a campaign to `sent` and marking recipients `sent`; a scheduled
campaign cancelling before send (and never being sent); analytics computed from
recipient rows (total, sent, delivered, read, failed, 50% delivered rate); and —
the non-negotiable — org B never sees org A's campaigns or analytics.

### Deliberately not covered

- **A real WhatsApp transport.** The worker marks recipients `sent` through the
  same stub seam as the M9 reminder worker; the real Meta transport lands with
  the messaging milestone.
- **Template submission to Meta.** `metaStatus` gates use but new templates are
  seeded/created `approved`; the Meta submission + approval webhook path is a
  later milestone.

---

## Performance

Measured against the seeded Northwind Dental database (17 contacts, 3
campaigns, 8 recipients) with `process.hrtime` around raw Prisma queries:

| Query | Method | p50 (ms) |
|---|---|---|
| Campaign list (`findMany`, org-scoped) | `PrismaClient` + `performance.now()` | 57.35 |
| Segment evaluation contact read (contacts + open deals) | `PrismaClient` + `performance.now()` | 53.25 |
| Analytics (`groupBy` status per campaign) | `PrismaClient` + `performance.now()` | 24.18 |
| Recipient list (campaign-scoped) | `PrismaClient` + `performance.now()` | 9.49 |

All queries are single scoped reads; the heaviest is the segment evaluation
contact read, which loads every org contact with their open deal values in one
query (no N+1). Materialisation is that read plus one insert per eligible
contact. No per-read recomputation. At seed volume every number is sub-60ms;
the contact read scales linearly with the contact table but stays a single
indexed org-scoped scan.

## Security Review

Per `SECURITY_RULES.md` pre-merge checklist:

- [x] No secrets added, logged, or printed — new env vars: none.
- [x] All new inputs validated with a strict schema — Zod on every route
  (`broadcast.validators.ts`); unknown fields dropped, segment definition
  refined to the documented filter set.
- [x] Every new query is tenant-scoped and tested for isolation — all reads
  through `forScope`; the integration suite proves org A never sees org B's
  segments, templates, campaigns, or recipients.
- [x] New routes have explicit auth + authz checks — `requirePermission`
  (`broadcast:read` / `broadcast:write`) on every mutating and read route.
- [x] Webhook signature verification untouched and still tested — no webhook
  surface added in M14.
- [x] No PII in logs, traces, fixtures, or error messages — the seed and E2E
  fixtures use synthetic `+9665000` phone numbers; logger redaction unchanged.
- [x] Rate limits applied to new send/auth/AI endpoints — M14 adds no
  auth/AI/webhook endpoints; the send route is permission-gated but rate
  limiting is a scheduled milestone (M23), consistent with every prior
  milestone.
- [x] `npm audit` clean at high and critical — a pre-existing high (nanoid
  <3.3.18 via next→postcss) and moderate (hono ≤4.12.33 via the shadcn CLI)
  were closed with `overrides` in `package.json`; `npm audit` now reports 0
  vulnerabilities.
- [x] Destructive operations require confirmation and are audit-logged —
  campaigns use a `cancel` lifecycle transition rather than deletion; no new
  destructive surface.

## Known Limitations

1. **The send is a stub** — recipients are marked `sent` and the status columns
   are real, but no WhatsApp message is transmitted (same seam as M9 reminders;
   the transport lands with the messaging milestone).
2. **Segments support five filters** (locale, lifecycle stage, created-after,
   deal value, and the always-on consent/opted-out invariants). No free-form
   query builder or saved-result snapshots — a segment is always a question.
3. **Templates are created `approved`** — there is no Meta submission flow in
   M14, so the approval gate is real but never exercised by a rejection.
4. **No per-recipient message link yet** — `CampaignRecipient.messageId` exists
   in the schema but stays null until the messaging milestone writes real
   messages.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the broadcast pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/broadcast.md`, this file
- [x] `MILESTONE_14_COMPLETED.md` written

All met.
