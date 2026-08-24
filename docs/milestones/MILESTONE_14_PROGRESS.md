# Milestone 14 — Broadcast System — Progress

Status: In Progress → Completed
Started: 2026-08-15
Last updated: 2026-08-23

> **Batch decision**: Milestones 12–14 were executed as one approved batch
> ("proceed on green"): sequential implementation, per-milestone exit gates,
> per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits. This
> file records that decision for the audit trail. Any red gate stops the whole
> batch.

## Completed Tasks

- [x] `src/features/broadcast/` service layer — segments (pure filter-tree evaluation with hard-coded consent/opted-out invariants), template approval gating, campaign lifecycle, analytics
- [x] Repositories — segments, templates, campaigns + recipients; `forScope` everywhere; writes derive branch scope from the default branch
- [x] API surface (plan AD-6) — segments GET/POST, segment preview POST, templates GET/POST, campaigns GET/POST, campaign detail GET/PATCH, campaign send POST
- [x] Campaign lifecycle draft → scheduled → sending → sent / cancelled; schedule/send/cancel transitions with 409 guards
- [x] Send-time materialisation — segment evaluated against contacts, opted-out excluded, one `CampaignRecipient` per contact (unique `(campaignId, contactId)`); zero-eligible campaign refused 422
- [x] DB-polled worker materialises due scheduled campaigns and updates each recipient only after an injectable transport acknowledges or rejects delivery
- [x] Analytics — per-campaign totals (total, sent, delivered, read, failed, delivered rate) derived from recipient rows; segment preview count before send
- [x] `/broadcast` UI — status-filtered campaign list + create dialog (segment + approved template + schedule), campaign detail (lifecycle actions, analytics, recipients), segment manager (create + preview), template manager (create + approval status)
- [x] Permissions `broadcast:read`/`broadcast:write`, nav item + icon, middleware matcher
- [x] Seed — segment, approved template, campaigns across lifecycle states with delivery-status recipients
- [x] Unit (14), component (13), integration (9), E2E (4 × 2 projects) tests; typecheck/lint/build/drift all pass; axe audits clean
- [x] Security review per `SECURITY_RULES.md` pre-merge checklist — recorded in `MILESTONE_14_COMPLETED.md`; `npm audit` 0 vulnerabilities (closed pre-existing nanoid high + hono moderate via `overrides`)
- [x] Performance measured (sub-60ms on all broadcast queries at seed volume) — recorded in `MILESTONE_14_COMPLETED.md`
- [x] Docs updated — `README.md` status, `CHANGELOG.md`, `docs/api/broadcast.md`, architecture overview, PLAN/PROGRESS/COMPLETED set

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Analytics `total` counted only `queued` recipients — read 0 for a sent campaign (no queued rows left) | Resolved | Total counts every status (`queued + sent + failed`) |
| 2 | Permissions test caught `broadcast:read/write` missing on `member` while `viewer` held read | Resolved | Role matrix completed — owner/admin/member read+write, viewer read |
| 3 | Pre-existing time-of-day flake in the appointments integration test (booked a hardcoded past date; the 1h reminder lead was in the past after ~08:00 UTC) | Resolved | Test books the nearest future Sunday 09:00 UTC; verified failing on a clean checkout before fixing |
| 4 | Worker marked queued recipients sent without delivery and finalized scheduled campaigns without materialising them | Resolved | Added fail-closed transport boundary, per-recipient outcomes, and scheduled materialisation regression tests |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-15 | Segments are a filter tree evaluated at send time, with consent invariants hard-coded in `evaluateSegment` | A segment is a question, not a snapshot; a broadcast to an opted-out contact is a compliance failure, not a filter choice | Storing a materialised member list |
| 2026-08-23 | Unconfigured WhatsApp delivery fails closed per recipient | `sent` means transport acknowledgement; Meta remains M19 | Treating a no-op as delivery |
| 2026-08-15 | Templates created `approved` | Meta submission is a later-milestone integration; the approval gate is real and gating use today | Building the Meta submission flow now |

## Database Changes

No schema changes in M14 — the M4 schema already designed `segments`,
`whatsapp_message_templates`, `campaigns`, `campaign_recipients` with the
filter-tree JSON, approval status, schedule columns, and the unique
`(campaignId, contactId)` recipient guard.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET/POST /api/broadcast/segments`, `POST /api/broadcast/segments/[id]/preview`, `GET/POST /api/broadcast/templates`, `GET/POST /api/broadcast/campaigns`, `GET/PATCH /api/broadcast/campaigns/[id]`, `POST /api/broadcast/campaigns/[id]/send` | New broadcast API surface | No (new surface) |

## Breaking Changes

None.
