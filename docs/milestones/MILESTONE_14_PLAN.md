# Milestone 14 — Broadcast System

Created: 2026-08-15
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 14`
Status: Completed 2026-08-16 — see `MILESTONE_14_COMPLETED.md`

---

## Objective

Build the Broadcast System: campaigns, scheduling, segmentation, templates,
and analytics. The M4 schema already designed `Segment`, `WhatsappMessageTemplate`,
`Campaign`, and `CampaignRecipient` — segments are a filter tree evaluated
against contacts at send time (a segment is a question, not a snapshot), and a
campaign recipient links back to `messages` so a broadcast and a conversation
are the same message stream. This milestone implements the service layer, API,
and UI on top.

True after this milestone, and not true now:

- Segments are manageable: a name plus a filter tree (locale, lifecycle stage,
  consent, deal value, created-after) evaluated against contacts at send time.
  Only consented, non-opted-out contacts can be included — a broadcast to an
  opted-out contact is refused, not silently skipped (DATABASE_RULES.md).
- WhatsApp message templates are manageable per branch: name, language, body
  (with the variable placeholders), and a Meta approval status that gates use
  (an unapproved template cannot be used in a campaign).
- Campaigns are manageable: name, segment, template, schedule (draft →
  scheduled → sending → sent / cancelled). A scheduled campaign can be
  cancelled before it sends; sending materialises recipients from the segment
  evaluation, excludes opted-out contacts, and records per-recipient
  `DeliveryStatus` rows.
- A DB-polled worker materialises due campaigns and records recipient success
  only after transport acknowledgement. Until M19 configures Meta, delivery
  fails visibly instead of producing a false `sent` status.
- Analytics exist: per-campaign totals (sent, delivered, read, failed,
  delivered rate) from the recipient rows, plus a segment preview count before
  send.
- The `/broadcast` UI lists campaigns, opens a campaign detail (segment,
  template, schedule, analytics), and manages segments and templates.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits
  the broadcast pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 14`:

```
Broadcast System

Campaigns

Scheduling

Segmentation

Templates

Analytics

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/broadcast/` feature domain

```
src/features/broadcast/
  repositories/broadcast.repository.ts   # only DB access; forScope everywhere
  services/segments.ts                   # pure filter-tree evaluation
  services/broadcast.service.ts          # orchestration: campaigns, scheduling, lifecycle
  services/worker.ts                     # the DB-polled send worker's processing steps
  validators/broadcast.validators.ts     # zod schemas for all routes
  hooks/use-broadcast.ts                 # React Query hooks + mutations
  components/campaign-list.tsx           # status-filtered list + create dialog
  components/campaign-detail.tsx         # segment/template/schedule + analytics
  components/segment-manager.tsx         # segment list + create
  components/template-manager.tsx        # template list + create
```

The feature directory is `broadcast` per `ARCHITECTURE_RULES.md` §5's domain
table. The repository is the only layer that touches the database; every query
runs through `forScope`. All four tables are BRANCH-scoped, so writes derive a
branch scope from the default branch.

### AD-2 — Segments are a filter tree, evaluated at send time

The schema's `Segment.definition` is JSON. The shape is typed in code:

```
definition: {
  locale?: string
  lifecycleStage?: 'lead'|'prospect'|'customer'
  hasConsent?: boolean
  createdAtAfter?: string      // ISO date
  dealValueMin?: number        // any open deal ≥ this value
  // all operators are ANDed
}
```

`evaluateSegment(definition, contacts)` is a **pure function**: given the
definition and a list of contact rows it returns the matching ids. Consent is
non-negotiable: `hasConsent: true` is always required in the effective
predicate, and `optedOutAt` is always excluded — the segment definition cannot
weaken either (a broadcast to an opted-out contact is a compliance failure, not
a filter choice). The service applies these invariants on top of the definition.

### AD-3 — Campaign lifecycle + materialisation

`draft → scheduled → sending → sent / cancelled`. Creating a campaign requires
a segment, a template, and (optionally) a `scheduledFor`. Sending materialises
recipients: the service evaluates the segment against the org's contacts,
filters to `hasConsent && !optedOutAt`, writes one `CampaignRecipient` per
contact (unique `(campaignId, contactId)`), and advances to `sending`. A
campaign with **zero eligible recipients is refused** (422) rather than
silently sending nothing.

### AD-4 — The send worker

A DB-polled worker (`npm run broadcast:work`) claims due `scheduled` campaigns
(and `sending` ones in flight), materialises recipients, invokes an injectable
transport, records acknowledged/failed recipient outcomes, and advances the
campaign to `sent` (`finishedAt`). The worker's processing steps are plain
async functions so the integration test drives them without faking timers —
the established pattern.

### AD-5 — Templates and Meta approval

Templates carry `metaStatus` (`TemplateApprovalStatus`). A campaign can only be
created against an `approved` template — an unapproved template is refused
(409) with a clear message. Templates are branch-scoped and unique per
`(branchId, name, language)`.

### AD-6 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/broadcast/segments` | GET | `broadcast:read` | — | `{ segments }` |
| `/api/broadcast/segments` | POST | `broadcast:write` | `{ name, definition }` | `{ segment }` 201 |
| `/api/broadcast/segments/[id]/preview` | POST | `broadcast:read` | — | `{ count }` |
| `/api/broadcast/templates` | GET | `broadcast:read` | — | `{ templates }` |
| `/api/broadcast/templates` | POST | `broadcast:write` | `{ name, language, body }` | `{ template }` 201 |
| `/api/broadcast/campaigns` | GET | `broadcast:read` | `?status=` | `{ campaigns }` |
| `/api/broadcast/campaigns` | POST | `broadcast:write` | `{ name, segmentId, templateId, scheduledFor? }` | `{ campaign }` 201 |
| `/api/broadcast/campaigns/[id]` | GET | `broadcast:read` | — | `{ campaign, analytics }` |
| `/api/broadcast/campaigns/[id]` | PATCH | `broadcast:write` | `{ action }` | `{ campaign }` |
| `/api/broadcast/campaigns/[id]/send` | POST | `broadcast:write` | — | `{ campaign }` |

Cross-tenant or missing ids are 404, never 403. Illegal transitions are 409.

### AD-7 — Analytics

Per-campaign analytics are derived from `CampaignRecipient` rows: `{ total,
sent, delivered, read, failed, deliveredRate }`. A segment preview returns the
eligible count before any campaign is created. Analytics are read-only
derivations — no extra tables.

---

## Dependencies

No new packages. The WhatsApp send is the same stub seam as the M9 reminder
worker (rows are marked `sent`; the real transport lands with the messaging
milestone). The worker is `npm run broadcast:work` with the established
DB-polled pattern.

**Upstream**: M4 schema (all four tables), M10 CRM (deal value / lifecycle
stage on contacts), M12 (envelope + money conventions), M13 (worker seam).

## Database Impact

No schema changes. The M4 schema already provides `segments`,
`whatsapp_message_templates`, `campaigns`, `campaign_recipients` with the
filter-tree JSON, approval status, schedule columns, and the unique
`(campaignId, contactId)` recipient guard. `schema-change.md` is untouched.

## API Impact

New surface (AD-6). All routes follow the house envelope (`withApiHandler`,
`jsonSuccess`, Zod validation, correlation id). No breaking changes.

## UI Impact

- `/broadcast` — campaign list (status-filtered) with a create doorway
  (segment + template + schedule) and per-campaign analytics.
- `/broadcast/[id]` — campaign detail: segment, template, schedule, lifecycle
  actions (schedule, send now, cancel), and analytics (totals + delivered
  rate).
- `/broadcast/segments` — segment manager (list + create + preview count).
- `/broadcast/templates` — template manager (list + create + approval status).
- States: loading/error/empty per the house component rules. Responsive and
  axe-clean (WCAG 2.2 AA).

## AI Impact

None in M14. Broadcasts are deterministic sends; the AI engine's tool surface
is untouched (campaign authoring could use AI in a later milestone).

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; cross-tenant reads are 404 |
| Consent compliance | `evaluateSegment` cannot weaken `hasConsent` / `optedOutAt`; a zero-eligible campaign is refused |
| Authorization | `broadcast:read/write` enforced server-side |
| Recipient uniqueness | Schema `(campaignId, contactId)` unique — re-sending cannot duplicate |

## Testing Strategy

- **Unit**: `evaluateSegment` (locale, lifecycle, consent invariant, opted-out
  exclusion, deal value, created-after), template approval gate, campaign
  transition guards.
- **Component**: list/detail/segment/template states (loading/error/empty/
  populated), lifecycle buttons, axe-clean.
- **Integration** (real Postgres): segment CRUD + preview, template CRUD +
  approval gate, campaign create → schedule → send materialises recipients
  (opted-out excluded), cancel before send, worker marks recipients sent,
  analytics totals, **org A never sees org B**.
- **E2E**: seeded list, create campaign from dialog, segment preview, axe clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp transport unavailable | High | Sends can't be exercised live | Worker marks recipients `sent` (stub seam); status columns real; integration-tested |
| Consent filter accidentally weakened | Medium | Compliance failure | `evaluateSegment` hard-codes consent + opted-out exclusion; integration test asserts an opted-out contact never appears |
| Zero-recipient campaign | Medium | Silent no-op | Refused with 422 at send time |
