# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Updating this file is part of development, not a follow-up task. Every user-visible
change gets an entry in the same PR.

---

## Rules

- Add to `[Unreleased]` as you work. Never write an entry after the fact from git log.
- Categories, in this order: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
  `Security`.
- Write for the reader, not the author. Describe the change in behaviour, not the diff.
- Mark breaking changes with **BREAKING** and state the migration path.
- Never include secrets, customer data, phone numbers, or internal-only identifiers.
- On release, rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` and open a fresh
  `[Unreleased]`.
- Version bumps: `MAJOR` breaking, `MINOR` new feature, `PATCH` fix.

---

## [Unreleased]

### Added

**Milestone 16 — Reviews**

- A reviews system at `/reviews`: a review list with a needs-attention badge
  for ratings below 4, a review-request list with send/cancel lifecycle actions,
  and a platform list showing Google/Facebook connection state.
- The three Tier-2 review tables from the M4 ER diagram are migrated now:
  `review_platforms`, `review_requests`, `reviews`. A request links a consented
  contact to the completed appointment that triggered it and targets a
  platform; a review hangs off its request with a 1–5 rating (DB CHECK
  constrained) and the feedback text.
- The consent invariants from M14 apply: a review request for a non-consenting
  or opted-out contact is refused (422), never silently skipped, and the
  automation worker never asks one.
- Google and Facebook sit behind a review-platform seam mirroring the M12
  payment gateways — both `unconfigured` in M16 (the real APIs need OAuth
  credentials) and failing loudly rather than faking a connection.
- Automation: `npm run reviews:work` finds completed appointments past a 24-hour
  grace window, creates + sends a review request through the transport stub
  seam, and sweeps expired requests — idempotent via the unique
  `(appointmentId, platformId)` guard.
- The reviews API is fully tenant-scoped: every query runs through `forScope`,
  and the integration suite proves org A can never see org B's reviews,
  requests, or platforms.

**Milestone 15 — Analytics**

- An analytics surface at `/analytics` covering revenue, funnels, conversion,
  retention, bookings, performance, and forecasting — all derived at read time
  from existing rows, with no new tables.
- Revenue: invoiced vs collected vs outstanding vs refunds with a daily
  invoiced/collected trend, sourced from invoice statuses, `paidAt`, and
  `amountPaid`.
- Funnels: the CRM pipeline as a funnel (deals per stage) and a
  quote → invoice → paid conversion funnel.
- Conversion: quote acceptance, quote → invoice, invoice → paid, and deal win
  rates, each `null` when there is no baseline.
- Retention: contacts by lifecycle stage and a behavioural cohort measure —
  contacts created in the range who still have activity afterwards.
- Bookings: appointment volume by status, booking value (service price at
  booking time), and cancellation/no-show rates.
- Performance: conversation volume, first-response time, escalation rate,
  workload per assignee, and campaign delivery counts.
- Forecasting: the weighted pipeline value (Σ open deal × stage win
  probability, decomposed per stage — the `winProbability` column planted in
  the M4 schema) plus a 3-month trailing-average projection explicitly labelled
  "past trend, not a commitment".
- The page is a read-only server-rendered surface with per-widget Suspense and
  a 30d/90d/180d/12m range picker (cookie-persisted). Every chart uses the
  house primitives with the accessible table fallback; the integration suite
  proves org A can never see org B's revenue, deals, appointments, or contacts.

**Milestone 14 — Broadcast System**

- A broadcast system at `/broadcast`: a status-filtered campaign list, a create
  dialog (segment + approved template + optional schedule), and a campaign
  detail page with the lifecycle actions (schedule, send now, cancel) and
  analytics derived from the recipient rows (total, sent, delivered, read,
  failed, delivered rate).
- Segments are filter trees evaluated against contacts at send time — a
  question, not a snapshot. The evaluation hard-codes the consent invariants:
  a contact without consent, or who has opted out, can never be included, and
  a campaign with zero eligible recipients is refused (422) rather than
  silently sending nothing. A segment preview returns the eligible count before
  any send.
- WhatsApp message templates are manageable per branch with a Meta approval
  status that gates use: a campaign can only be created against an `approved`
  template (409 otherwise), and templates are unique per `(branch, name,
  language)`.
- Campaigns follow `draft → scheduled → sending → sent / cancelled`. Sending
  materialises one `CampaignRecipient` per eligible contact (unique
  `(campaignId, contactId)`, so a re-send cannot duplicate) and records
  `DeliveryStatus` rows.
- A DB-polled worker (`npm run broadcast:work`) claims due scheduled or
  in-flight sending campaigns, marks recipients `sent`, and advances the
  campaign to `sent`. The WhatsApp send path is the same stub seam as the
  reminder worker — the status columns are real and integration tested.
- The broadcast API is fully tenant-scoped: every query runs through `forScope`,
  and the integration suite proves org A can never see org B's segments,
  templates, campaigns, or recipients.

**Milestone 13 — Workflow Builder**

- A workflow builder at `/workflows`: a workflow list with create + enable/
  disable toggles, and a builder page that edits the node graph (trigger →
  conditions → actions → delays) with a live validation summary.
- The graph is versioned: every save writes a new immutable `WorkflowVersion`
  with an incremented number, so a published graph is never mutated in place.
  Enabling a workflow requires at least one saved version (else 409).
- Server-side graph validation is the authority: unknown node references,
  non-binary condition branches, branch labels on non-condition edges, and
  duplicate variable names are all refused (409) rather than saved.
- Manual test runs write a `WorkflowRun` plus one `WorkflowRunStep` per node,
  walking the graph along the true path; delay nodes land `pending` with a
  `scheduledFor` for the scheduler to pick up.
- The workflow API is fully tenant-scoped: every query runs through `forScope`,
  and the integration suite proves org A can never see org B's workflows.

**Milestone 12 — Invoicing and Payments**

- An invoicing system at `/invoices`: a status-filtered invoice list, a create
  dialog with a live VAT preview (standalone or from an accepted quote), and an
  invoice detail page with line items, totals, payment history, refunds, and a
  PDF download.
- The lifecycle is real: draft → issued → partially_paid → paid / overdue /
  void, with `mark_paid` as the manual override for cash/offline payments.
  Only a draft can be edited; a paid or void invoice cannot be voided.
- Invoices are numbered sequentially per organization (`INV-1000`, `INV-1001`, …)
  and can be created from a quote exactly once — the quote's stored rate+amount
  columns are copied verbatim, never recomputed.
- Payments record against an invoice through a gateway seam: Stripe is the first
  real adapter (test-mode), and HyperPay/PayTabs/STC Pay/Apple Pay are registered
  `unconfigured` adapters behind the same interface.
- A webhook journal captures every gateway event with unique `gatewayPaymentId` /
  `gatewayEventId` keys, so a retried webhook is a structural no-op — a replay can
  never double-charge. The journal never stores card data, keeping the system out
  of PCI scope.
- Refunds record against a succeeded payment with a reason and recompute the
  invoice's `amountPaid` downward.
- The invoice API is fully tenant-scoped: every query runs through `forScope`,
  and the integration suite proves org A can never see org B's invoices.

**Milestone 11 — Quotation System**

- A quotation system at `/quotes`: a status-filtered quote list, a create dialog
  with live VAT preview (15% default, overridable per line), and a quote detail
  page with line items, totals, the status lifecycle, and version history.
- The lifecycle is real and versioned: draft → send snapshots the full quote to a
  `QuoteVersion` (so the accepted/rejected document is the exact one the customer
  saw) → accepted / rejected / expired. Only a draft can be edited; only a sent
  quote can be accepted, rejected, or expired; an accepted quote cannot return to
  draft.
- Quotes are numbered sequentially per organization (`Q-1000`, `Q-1001`, …).
- VAT math is stored, not recomputed: each line keeps its rate AND amount at write
  time, so a historical quote never silently reprices at today's rate.
- Templates are manageable per branch (`/quotes/templates`) with branding; the
  footer flows into the PDF.
- A dependency-free PDF export renders the quote with a line-item table, VAT
  breakdown, totals, validity, and branding footer — inline in the browser.
- The quote API is fully tenant-scoped: every query runs through `forScope`, and
  the integration suite proves org A can never see org B's quotes.

**Milestone 10 — CRM**

- A CRM at `/crm`: a pipeline board with per-stage columns and deal cards, a deal
  drawer with timeline + stage moves + close (won/lost) + notes/calls/emails/
  meetings, a companies list with create, a tag manager, and a tasks list with
  create + complete.
- Deals are leads and deals in one table: a deal in an early stage is a lead;
  moving between stages and closing (`won`/`lost` with `closedAt`) is the core
  lifecycle, and every mutation writes an `Activity` to the deal's timeline
  through one `recordActivity` seam.
- Tags are polymorphic (`taggables`): the same join table labels deals, contacts,
  and conversations, and re-tagging a subject is idempotent (unique constraint).
- Tasks gain their M10 surface — the M5 `tasks` table is now manageable with
  status transitions and due dates.
- Automation: simple rule-based triggers (new deal → auto-assign, deal value ≥
  threshold → add a tag, company created → default tag) evaluated by a DB-polled
  worker (`npm run crm:work`). Rule application is idempotent, guarded by
  activity/tag markers so a re-run cannot double-apply.
- Pipeline stages carry win probability for the weighted forecasting that arrives
  at Milestone 15; the board surfaces it per stage.
- The CRM is fully tenant-scoped: every query runs through `forScope`, and the
  seed includes a cross-tenant beacon deal/task that org A can never see.

**Milestone 9 — Appointment Engine**

- An appointment engine at `/appointments`: a calendar of the next 14 days, a
  booking form that lists real open slots per resource, services and resources
  management, and an appointment detail page with reschedule and cancel (with a
  confirm step).
- Availability is computed from weekly rules plus exceptions, in the appointment's
  timezone, and the database's exclusion constraint is the authoritative
  double-booking backstop — a race surfaces as a clean 409.
- Recurring appointments use an RRULE subset (`FREQ=WEEKLY|DAILY` with `COUNT` or
  `UNTIL`); a series is a parent appointment with children linked by
  `recurrenceParentId`, and editing or cancelling one occurrence creates an
  exception rather than materialising every future instance.
- Reminders are scheduled per booking (24h and 1h before) into
  `appointment_reminders`; a DB-polled worker (`npm run reminders:work`) marks due
  reminders sent/failed. Delivery is a no-op stub until the WhatsApp messaging
  milestone.
- Rescheduling links the replacement appointment back to the original via
  `rescheduledFromId` and marks the original rescheduled, so the history is
  navigable.
- Appointment timezone is recorded per booking (the intent) and validated;
  availability is computed in that zone then stored as UTC instants.
- The dashboard's upcoming appointments now open a real detail page instead of a
  stub.

**Milestone 7 — Knowledge Base**

- A knowledge base at `/knowledge` with sources, documents, version timelines, and
  search — upload a PDF/DOCX/CSV, enter FAQs, or ingest a website, and the AI can
  cite what it knows.
- Uploaded files are stored as blobs (never in Postgres), parsed in a background
  worker (OCR via tesseract.js for scanned PDFs), chunked into ~800-token
  overlapping pieces, embedded, and indexed — the database is the queue, so no
  Redis or external service is required until Milestone 24.
- Documents are versioned with an approval gate: a new upload creates a draft
  version, only an approved version becomes "current", and retrieval (vector +
  keyword) can only ever cite approved current versions. The seed includes a draft
  HR handbook that search must NOT surface.
- Embeddings come from the new AI Gateway: OpenAI `text-embedding-3-small` when
  `OPENAI_API_KEY` is set, with a deterministic local hash embedder as the default
  so tests, CI, and the seed need no key. The per-chunk `embeddingModel` makes a
  later provider switch a re-embedding job, not a redesign.
- Ingestion status is tracked in `ingestion_jobs` and polled in the UI, so a job
  that fails reports its error instead of silently vanishing.
- Knowledge approval is admin/owner-only (`knowledge:approve`); members can read
  and write; viewers can read.

**Milestone 5 — Dashboard**

- A real dashboard at `/dashboard` replaces the Milestone-2 placeholder: a greeting
  and date-range picker up top, then four KPIs (new conversations, response time, open
  revenue, open leads), a conversations-over-time chart, cumulative revenue, an
  activity feed, upcoming appointments, and recent conversations — all org-scoped and
  rendered from the seeded data.
- The date range is global and persisted: choosing 30 or 90 days stores a cookie the
  server reads, so the first paint already reflects the choice and every widget
  follows it.
- Each widget loads and fails on its own. The slowest query delays only its own card,
  and a failing widget never blanks the rest of the dashboard.
- The designed app shell (sidebar with route-highlighted navigation, workspace
  switcher, account menu) replaces the Milestone-2 top bar for signed-in users.
- A notifications bell in the shell header shows an unread count and a dropdown of the
  latest notifications for the active organization.
- The inbox, contacts, and appointment links on the dashboard lead to deliberate
  "being built" stubs, so every doorway is real without shipping half-built screens.

**Milestone 6 — Inbox**

- A real two-pane inbox at `/inbox` replaces the stub: a conversation list (filterable
  by status, assignee, and search) beside a message thread with a composer.
- Agents can reply, archive, pin, assign, and label conversations, add internal notes,
  attach files, and send voice/emoji messages — every action persisted and reflected
  in the list without a full reload.
- The list and thread refresh automatically every few seconds via polling that pauses
  when the tab is hidden; a typing indicator shows when another agent is composing,
  and opening a thread marks it read and clears the unread count.
- Search across message bodies and contacts uses a trigram index; results never cross
  organizations.
- Read status is tracked per user with a read-receipt table, so the unread badge is
  accurate per reader.
- Heuristic AI suggestions (escalation, complaints, FAQ hits, follow-ups) and a
  plain-language conversation summary render without any LLM — a deliberate seam for
  the real AI Engine in Milestone 8.
- Attachments are stored as files with signed, short-lived download URLs rather than
  in the database.

### Changed

- Sidebar navigation icons are passed by name rather than as component references, so
  the server layout can hand the nav to the client shell without React rejecting it at
  runtime.
- Dashboard notifications are ordered unread-first; they were previously read-first,
  which buried the one the bell exists to surface.
- The notifications bell now reads the API's actual response shape; it previously
  crashed with a client-side error on every dashboard load.

### Fixed

- The inbox conversation list crashed with `lastMessageAt.toISOString is not a
  function` whenever it was rendered from the API: dates arrive as ISO strings
  over JSON, and the row and message components called date methods on them. The
  hooks now rehydrate date fields.
- Opening a conversation thread showed an error boundary: the thread view polled
  `GET /api/inbox/conversations/[id]`, which only implemented `PATCH`. The GET
  handler now returns the full thread (conversation, messages, notes, summary,
  suggestions, typing).
- The thread's label list crashed with `(j.data ?? []).map is not a function`:
  the labels endpoint returns `{ labels }` but the hook treated it as a bare
  array.
- The inbox filter tabs carried `aria-controls` pointing at panels that did not
  exist, which axe flagged as a critical `aria-valid-attr-value` violation. Each
  tab now has a real (hidden) panel.

**Milestone 5 — Dashboard**

- A runtime crash on every authenticated page: the server layout passed Lucide icon
  component references into the client app shell, which React cannot serialise. The
  nav now carries icon names, resolved to icons on the client.

### Security

- Every dashboard query runs through the scoped Prisma client with a scope resolved
  from the session's organization — never from a request parameter. A new integration
  suite proves org A cannot see org B's conversations, invoices, deals, or activity.

**Milestone 4 — Database**

- The data model for the whole product: 50 new tables covering the inbox, knowledge
  base, AI runs, scheduling, CRM, quotes, invoices, payments, workflows, and campaigns.
  An ER diagram covering all 85 tables across all 25 milestones is committed at
  `docs/database/er-diagram.md`.
- Businesses can have multiple branches. Every organization gets one automatically, and
  conversations, contacts, calendars, knowledge, and AI settings all belong to a
  specific branch — so a two-location business sees two separate inboxes rather than
  one merged list.
- Appointments cannot be double-booked. Two people booking the same person or room at
  overlapping times is refused by the database itself, so it holds even when both
  bookings arrive at the same instant.
- Deleting something moves it to the trash and it can be restored. This is separate
  from erasing a customer's personal data, which is now a distinct, tested operation.
- A customer can ask for their data to be erased. Their name, phone number, email,
  message contents, attachments, and any notes quoting them are overwritten, while the
  record of the request being honoured survives — so the business can still prove it
  complied.
- Money is stored to four decimal places with its currency alongside, and tax is
  recorded as the rate that applied on the day plus the amount it produced. Reissuing
  an old invoice will not silently reprice it at today's VAT rate.
- Appointments store both the exact instant and the timezone they were booked in, so
  "9am local" survives a daylight-saving rule change.
- `npm run db:seed` now produces a database you can demo from: two businesses, staff in
  every role, conversations in every state, appointments past and upcoming, and enough
  CRM and invoice history for charts to render. It is deterministic, so screenshots and
  end-to-end tests are reproducible.

### Changed

- **Local Postgres image is now `pgvector/pgvector:pg17`.** Stock `postgres:17-alpine`
  does not include the `vector` extension the knowledge base needs. Run
  `npm run db:up` to pick it up; existing local data is preserved.

### Fixed

- Every timestamp in the database is now stored with its timezone. They were previously
  stored without one, which would have produced wrong appointment times for any
  business operating across more than one region.

### Security

- Queries are scoped to the signed-in organization and branch centrally rather than at
  each call site, and database operations that cannot be scoped safely are refused
  outright. Covered by 32 tests that attempt cross-tenant access and prove it returns
  nothing. Reaching for the unscoped database client from feature code is now a build
  error rather than a review comment, so the guarantee cannot be stepped around by
  accident.
- Inbound WhatsApp messages are de-duplicated by the database, so a retried delivery
  from Meta cannot create a second copy of the same message.

**Milestone 3 — Design System**

- Design tokens completed: `--success`, `--warning`, `--info` (each with `-foreground`
  and `-subtle`), a categorical six-colour chart palette separated by hue rather than
  lightness, a two-layer `--elevation-xs…xl` scale, a named `--z-*` scale, and
  `--radius` corrected to 16px. Every component consumes tokens only.
- Light and dark themes, switchable and remembered, with no flash of the wrong theme
  on load. A theme switcher offers light, dark, or follow-the-system.
- `prefers-reduced-motion` is honoured globally, and components that animate in
  JavaScript check it individually rather than relying on the CSS reset.
- Form components: labelled field wrapper, text field, select, textarea, checkbox,
  radio, switch, date picker (localised, popover calendar), and time picker (fixed
  slots, canonical 24-hour value, localised display).
- Data components: sortable table with `aria-sort`, pagination, and table-shaped empty
  and loading states; metric card that requires a comparison period and colours by
  sentiment rather than by sign; line, area, bar, and sparkline charts, each shipping a
  screen-reader data table; timeline; markdown renderer.
- Rich text editor whose schema is the allow-list, so unknown markup is dropped rather
  than escaped, and `javascript:`/`data:` links never become links.
- File uploader with drag and drop, a keyboard route, previews, progress, and
  client-side type and size validation.
- Overlays: dialog, sheet, dropdown, popover, tooltip, toasts, and a ⌘K/Ctrl+K command
  palette that matches on keywords as well as labels.
- Navigation: collapsible sidebar whose active item comes from the route and whose
  collapse state survives a reload, sticky page header, breadcrumbs, tabs, accordion,
  and an application shell that turns the sidebar into a drawer on a phone.
- Empty, error, and loading states as components, so no screen can omit one.
- A development-only component gallery at `/design` showing every component in every
  state, with theme and direction toggles. It 404s in a production build.

**Email delivery — real SMTP**

- SMTP transport via nodemailer, working against any provider (Resend, Postmark, SES,
  Gmail, a corporate relay). Selected with `EMAIL_TRANSPORT=smtp`; switching provider
  changes environment variables only.
- The `console` transport now prints each message as a delimited block with the link on
  its own line, so a verification link is usable without a mail server.
- Environment validation refuses to boot in production unless `EMAIL_TRANSPORT=smtp`,
  and rejects a half-set SMTP credential pair — the dangerous state is one where the
  app starts and account-critical mail silently goes nowhere.
- The health check now verifies the SMTP connection alongside the database, in
  parallel. The console transport reports `not-configured` rather than `error`, so a
  deliberate development setting does not mark the service degraded.

**Milestone 2 — Authentication**

- Email/password sign-up and sign-in with mandatory email verification.
- Password reset via a single-use, one-hour, emailed link.
- Magic-link sign-in — single-use, 15-minute expiry.
- TOTP two-factor authentication with ten single-use backup codes, plus enrolment
  and removal from `/settings/security`. Both require the account password.
- OAuth via Google and GitHub, enabled only when credentials are configured.
- Organizations: create, list, switch, and manage members. Creator becomes owner.
- RBAC — four roles (`owner`, `admin`, `member`, `viewer`) across 18 permissions,
  enforced server-side on every protected route. Unknown roles are denied everything.
- Append-only audit log with PII sanitisation, exposed at `GET /api/audit-logs`.
- Database-backed sessions with immediate revocation.
- Auth screens: login, signup, forgot/reset password, verify email, two-factor
  challenge, security settings, members, and organization onboarding.

**Milestone 1 — Project Foundation**

- Next.js 16 (App Router) + React 19 + TypeScript in strict mode, with
  `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`.
- PostgreSQL 17 in Docker Compose, bound to loopback on host port 5433.
- Prisma 7 with the `@prisma/adapter-pg` driver adapter, initial migration, and seed.
- Environment validation (`src/lib/env.ts`) — Zod-parsed at boot; the app refuses to
  start on a missing or malformed variable and names every offending one.
- Structured logging (`src/lib/logger.ts`) — Pino with PII redaction configured at the
  logger, so a careless call site fails safe.
- Typed domain errors (`src/lib/errors.ts`) mapped to the documented status codes.
- API handler wrapper (`src/server/api-handler.ts`) providing correlation ids,
  request logging, and a consistent error envelope to every route.
- `GET /api/health` — liveness and database check with a 2-second timeout.
- React Query provider, Tailwind v4, shadcn/ui (Nova preset: Lucide + Geist).
- Error boundaries: route-level, global, and 404.
- Test suites: 72 unit/integration/component (Vitest) and 14 E2E (Playwright,
  five viewports from mobile to ultra-wide).
- CI pipeline: audit → generate → migrate → typecheck → lint → format → test →
  build → E2E, with a Postgres service container.
- Tooling gates: ESLint (0 warnings), Prettier, Husky, lint-staged, Commitlint.
- Documentation: README, architecture overview, API reference, schema-change record.

**Design system documentation** (audit against premium SaaS standards)

- `DESIGN_TOKENS.md` — three-tier token architecture, OKLCH colour values for light
  and dark, status and chart token specifications, two-layer elevation scale, named
  z-index scale, ramp generation, dark-mode strategy.
- `COMPONENT_DESIGN.md` — visual hierarchy, per-component spacing table, and visual
  specifications for cards, forms, tables, sidebar and navigation, dashboards, charts,
  badges, toasts, and modals. Includes SaaS dashboard best practice.
- `MOTION_RULES.md` — interaction state matrix (rest, hover, focus, pressed, selected,
  disabled, loading, error), Framer Motion API rules, micro-interaction catalogue,
  skeleton loader construction, page transitions.
- `ACCESSIBILITY_RULES.md` — WCAG 2.2 Level AA named as the conformance target, with
  the criteria most at risk in this product and a per-component and per-milestone
  verification procedure.
- `RTL_I18N_RULES.md` — Arabic and right-to-left support: logical properties, what
  flips and what does not, bidi text, numerals, Arabic typography, translation rules.
- `LANDING_PAGE_RULES.md` — marketing surface standards distinct from the product.

### Changed

- Auth screens are restyled onto the design system — a card surface, the shared field
  components, and a theme switcher. Structure and behaviour are unchanged; Milestone
  2's auth tests pass unmodified.
- `--muted-foreground`, `--destructive`, and `--success` are darker in light mode. All
  three failed the WCAG AA 4.5:1 text threshold at their previous values (4.34, 4.00,
  and 4.44 respectively), measured on the gallery.
- `--sidebar-accent` is darker in light mode. At 0.97 lightness against a 0.985 rail the
  active navigation item was all but invisible, which is the one state a sidebar cannot
  afford to be subtle about.
- The shared form field moved from `src/features/auth/components/form-field.tsx` to
  `src/components/form-field.tsx` and is now `TextField`. It is domain-agnostic and no
  longer implies that labelled inputs are an auth concern.

- **BREAKING** `AUTH_SECRET` is now required and must be at least 32 characters. The
  application refuses to start without it. Add it to every environment; generate with
  `openssl rand -base64 32`.
- `withApiHandler` now passes Next's route context as a third argument, so dynamic
  segments can read their params. Existing routes are unaffected.
- `DESIGN_RULES.md` — added a design-system file index, a layout composition section,
  and an expanded mobile-first strategy. Corrected the token location from the
  non-existent `src/ui/tokens.css` to `src/app/globals.css`.
- `MILESTONE_RULES.md` — recorded the token debt Milestone 3 must clear before any
  component is authored.

### Deprecated
- Nothing yet.

### Removed
- Nothing yet.

### Fixed

- Chart data tables no longer cause horizontal page overflow on a phone. `sr-only` on a
  `<table>` does not clamp it, so a full-width table sat off-screen and widened the
  document; the wrapper carries the class instead.
- The page header no longer nests an `<li>` inside an `<li>`, which the browser
  silently reshuffled into markup React disagreed with — discarding and re-rendering
  that part of the page on every load.
- The command palette no longer throws when opened. It rendered its input and items
  without the cmdk root that supplies their context.
- Rendering a stored rich-text document containing an unknown node no longer throws.
  Unknown content is rewritten to text rather than crashing the page around it.
- Loading regions carry `role="status"`. `aria-label` on a bare `<div>` is invalid ARIA
  and is ignored, so what was loading was announced as nothing at all.
- The gallery's animation section no longer renders different text on the server and the
  client, which made React discard and rebuild that part of the page under reduced
  motion.

- **Signup was completely broken.** Better Auth generates nanoid-style ids, which
  Postgres rejected for the `@db.Uuid` primary keys, so every registration failed with
  `P2007` and no account was created. The auth layer now generates real UUIDs
  (`advanced.database.generateId`). Found while manually verifying the setup, not by
  the test suite — see below.
- Signup no longer treats HTTP 400/422 as success. That masking existed to hide
  duplicate addresses, but the auth layer already handles duplicates
  enumeration-safely by returning 200 with no token. The masking instead concealed the
  id bug above, letting the E2E suite pass against a flow that created zero accounts.
  Added an API-level regression guard that asserts a real UUID is returned.
- Removed `NODE_ENV` from `.env`. Next.js sets it itself, and overriding it made
  `next start` behave as a development server — including injecting the dev-tools
  overlay into production HTML. Caught by the Milestone 1 tripwire test.

### Security
- `organizationId` is derived server-side from the session row and never from client
  input, which is what makes tenant scoping trustworthy. Proven by 17 integration tests.
- Cross-tenant access returns 404 rather than 403, so existence is never confirmed
  across tenants.
- Account enumeration is prevented on sign-in, sign-up, password reset, and magic
  link — all four return identical outcomes whether or not an address is registered.
- Open-redirect defence on the post-login `next` parameter: absolute, protocol-relative,
  backslash, encoded-traversal, and control-character vectors are all rejected. 30 tests.
- Privilege escalation is blocked — only an owner may create another owner, and the
  last owner can be neither demoted nor removed.
- Rate limiting on sign-in, sign-up, password reset, magic link, and two-factor.
- Audit metadata is stripped of PII in code, so a careless caller cannot write it.
- Security headers on every response: CSP, HSTS, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- `X-Powered-By` suppressed so the framework version is not advertised.
- Pinned `postcss` and `sharp` via npm overrides to clear three high-severity
  advisories inherited transitively from Next.js 16.2.12. `npm audit` reports 0
  vulnerabilities; CI fails the build on high or critical.
- Lint rules forbid reading `process.env` outside `src/lib/env.ts` and importing
  `@prisma/client` outside `src/lib/prisma.ts`.

---

## Template

```markdown
## [1.2.0] - 2026-08-14

### Added
- Human takeover in the inbox: an agent can claim a conversation and the AI stops
  replying until the thread is released. (Milestone 07)

### Changed
- **BREAKING** `POST /api/conversations/:id/messages` now requires `authorType`.
  Migration: send `"agent"` for staff-authored messages. Clients on the old contract
  receive 400 from 2026-09-01.

### Fixed
- Duplicate replies when Meta redelivered a webhook. Deliveries are now deduped on
  `whatsapp_message_id`.

### Security
- Webhook signatures are now compared in constant time.
```
