# Milestone 5 — Dashboard

Created: 2026-08-12
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 5`
Status: **Complete — structurally re-certified 2026-08-23**

---

## Objective

Replace the Milestone-2 placeholder at `/dashboard` with the real dashboard: KPI row, primary chart, activity feed, and recent-conversations table — built on the seeded Milestone-4 data, per-widget loading and failure, tenancy-scoped, and accessible. Wire the Milestone-3 design-system shell (sidebar + page header) into the authenticated app, and add the dashboard API/service/repository layer.

True after this milestone, and not true now:

- The authenticated user lands on a real, useful dashboard at `/dashboard` instead of a "Nothing here yet" card.
- Every KPI, chart, and list on the dashboard is tenant-scoped (org-level, across all branches) and rendered from real seeded data — no client-side mock numbers.
- Each dashboard widget loads independently (`Suspense` + per-widget skeleton) and fails independently (per-widget error boundary), per `COMPONENT_DESIGN.md §7`.
- The date range is global, top-of-page, and persisted; every widget reflects it.
- A sidebar with route-derived active state (`SidebarNav` + `AppShell` + `PageHeader`) replaces the Milestone-2 top bar in the authenticated shell.
- A dashboard repository + service layer exists, with the four-KPI aggregation, a 30-day conversation trend, revenue series, an activity feed, and recent conversations — all returning one page of data.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe has nothing to report.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` + `npm run test:e2e` pass; `npm run build` succeeds; axe audits the dashboard clean in both themes, both directions, at desktop and mobile.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 5`:

```
Dashboard

Build

Statistics

Cards

Charts

Activity Feed

Notifications

Tasks

Upcoming Appointments

Revenue

Leads

Recent Chats

Performance

Beautiful animations.

STOP
```

---

## Architecture Decisions

### AD-1 — The dashboard reads its data through a repository + service layer, tenant-scoped

Per `ARCHITECTURE_RULES.md` (`Component → API → Service → Repository → Database`), a new dashboard domain owns the queries:

- `src/features/dashboard/repositories/dashboard.repository.ts` — the only place these queries touch the DB; receives a `Scope` built from the session and scopes every query through `forScope(scope)` (`src/lib/db/scoped-prisma.ts`), never a raw `prisma` call with a hand-written `where`.
- `src/features/dashboard/services/dashboard.service.ts` — pure orchestration; composes the repository results into the view model, derives deltas/sentiment, builds the chart series buckets. No DB imports.
- `src/server/scope.ts` — **create** the missing `resolveScope(organizationId)` (referenced by `src/lib/db/scope.ts` today) that returns `{ organizationId, branchId: null }` — org-level, all branches — which is exactly what a dashboard wants (Milestone 18 makes branch scope user-visible; the hook exists now).

**Rejected: SQL `GROUP BY` through `$queryRaw`.** The four-KPI aggregates need 12 counts/sums from 5 tables, and each chart a bucketed series. Hand-rolled SQL would bypass the Prisma type layer and the scope extension; `groupBy`/`aggregate` on the scoped client (already in `FILTERING_OPERATIONS`) keeps everything typed and tenancy-safe. A time bucketer helper builds the series server-side. If a single query underperforms at seed volume, it is a bounded optimization with `EXPLAIN ANALYZE` evidence, not a premature raw-SQL rewrite.

### AD-2 — Four KPIs, chosen to make the most of the seeded data and the dashboard spec

`COMPONENT_DESIGN.md §7` caps the top row at four and requires every delta to carry a comparison ("1,284, up 12% on last week"). The KPIs, with period over period:

| KPI | Source | Primary delta | Sentiment |
|---|---|---|---|
| New conversations | `conversations` created in range | vs previous equal period | rise = good |
| Response time | avg `message` gap inbound→outbound, org | vs previous | **fall = good** (`sentiment: 'negative'` on a negative delta) |
| Open revenue | sum `invoice.totalAmount` where status `issued`/`partially_paid`/`overdue` | vs previous | rise = good |
| Open leads | count `deal` where status `open` | vs previous | rise = good |

Each KPI links to its filtered detail view (see AD-5). Response time exercises the "down is not always bad" rule from §7.

**Rejected: an "Appointments today" KPI.** The seed's appointment data is spread across a 120-day window, so "today" renders as a near-zero number on every seeded tenant — a wall-of-numbers row that reads as broken (R-5, and the §7 "most important information top-left" rule). Appointments are covered richly by the Upcoming Appointments card instead.

### AD-3 — Suspense per widget; no client-side data fetching

The server page streams each widget through its own `Suspense` boundary with a `LoadingState`-shaped skeleton, and each widget is wrapped in its own error boundary so one failure does not blank the dashboard (`COMPONENT_DESIGN.md §7` — loading is per-widget, failure is per-widget). The spec's "date range is global" is honored with a server-rendered widget that reads a single persisted value; see AD-4.

**Rejected: React Query + a `/api/dashboard` route.** This milestone has no client-driven mutation or polling — the dashboard is read-only. A client fetch would trade a typed, streaming server render for an extra network round trip and a bespoke API surface (`API_RULES.md`). The React Query stack stays in place for Milestone 6's inbox, which is genuinely interactive.

### AD-4 — Global date range, persisted in a cookie

Per §7 ("Date range is global and persisted, at the top, applying to every widget"), a `RangePicker` in the page header offers `30d` / `90d`. The choice persists in a cookie (`dashboard:range`) read server-side by the layout, so the first paint already reflects it — the same first-paint-correct pattern `AppShell` uses for `sidebar:collapsed` (`src/components/app-shell.tsx`).

- The server page reads the cookie and passes the `{ from, to }` bounds into the repository.
- The cookie is set via the existing `route handler` pattern (`PATCH`-style response setting `Set-Cookie`), with the same `SameSite=Lax; max-age=31536000` discipline as `persistCollapsed`.
- **30d is the default** (the seeded data spans ~120 days, so both options render real content); 90d is the alternative.

**Rejected: arbitrary date ranges / per-widget pickers.** The seeded data only supports ~120 days, arbitrary ranges would mostly render empty widgets on seeded tenants, and §7 forbids per-widget pickers that can disagree.

### AD-5 — Wire the Milestone-3 shell into the authenticated app

Replace `AppHeader` in `src/app/(app)/layout.tsx` with the designed `AppShell` + `SidebarNav` + `PageHeader` (`src/components/app-shell.tsx`, `sidebar-nav.tsx`, `page-header.tsx`). Nav sections (lucide icons, `NavSection` shape from `src/components/sidebar-nav.tsx`):

- **Main**: Dashboard (`/dashboard`), Inbox (`/inbox` — dead-ends to `notFound()` this milestone), Contacts (`/contacts` — same), Settings (`/settings`)
- The sidebar header shows the workspace switcher (org switcher ported from `AppHeader`); the footer shows the account menu (Security / Members / Sign out).

The dashboard page header carries a greeting ("Good morning, Alex"), the date-range picker, and an "Inbox" doorway link. The old `AppHeader` component stays in the tree (M6 references it) but is no longer rendered by the shell.

### AD-6 — Dashboard widgets and the "everything is a doorway" rule

- **Activity feed** — `Timeline` (`src/components/timeline.tsx`) fed by the last 8 `Activity` rows (polymorphic `subjectType`), each linking to a per-entity page. A "View all" link points at the future activity route. Where a target route does not exist yet, the link targets a `notFound()` stub so the doorway is real without being a 404 surprise.
- **Upcoming appointments** — next 5 non-cancelled `Appointment`s (booked/confirmed), each linking to an appointment detail stub.
- **Recent conversations** — `DataTable` (`src/components/data-table.tsx`), last 5 conversations, columns: contact, status badge, unread, last message time; each row links to the conversation detail stub (`/inbox/[id]`).
- **Notifications** — the 3 seeded notifications surface as a dismissible in-app panel/bell in the shell header, with unread count; not a bespoke full page.

**Scope guard (per `MILESTONE_RULES.md:19`):** the detail pages themselves (full inbox, contacts, appointments) are **Milestone 6+**. The dashboard links to `notFound()` stubs so the doorways exist without building future-milestone features.

---

## Dependencies

**New packages**: none. `recharts`, `motion`, `lucide-react`, `date-fns` are all present. The cookie read uses `next/headers`.

**Upstream milestones**: 1 (foundation), 2 (auth/tenancy), 3 (design system components), 4 (schema, seed, scoped client).

**External services**: none.

---

## Database Impact

**No schema changes.** The Milestone-4 Tier-1 schema already includes the dashboard-relevant models (`notifications`, `tasks`, `conversations`, `messages`, `deals`, `invoices`, `payments`, `refunds`, `appointments`, `activities`, `contacts`, `companies`). This milestone only **reads** them via the scoped client. No migrations, no rollback plan needed.

---

## API Impact

Two new route handlers, both wrapped in `withApiHandler` (`src/server/api-handler.ts`), auth via `requireOrg`/`requirePermission`:

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/dashboard/range` | `PATCH` | `requireOrg` | Persists the global date range. Body `{ range: '30d' \| '90d' }`; validates with Zod; sets the `dashboard:range` cookie (`SameSite=Lax`, max-age 1y); returns the value. |
| `/api/dashboard/notifications` | `GET` | `requireOrg` | Returns the current user's notifications for the active org (`readAt` null first) — feeds the header bell. |

No dashboard **read** route: the page is server-rendered (AD-3). Error responses follow the existing `ApiError` envelope. Tenant scope always comes from the session, never from the request.

---

## UI Impact

### Screens and components

- `src/app/(app)/dashboard/page.tsx` — rebuilt: `PageHeader` (greeting + `RangePicker` + Inbox doorway) + per-widget `Suspense` sections.
- New `src/features/dashboard/components/` (client components, per-widget, each owning its skeleton/empty/error):
  - `kpi-grid.tsx` (4 × `Metric` from `src/components/metric.tsx`)
  - `conversations-chart.tsx` (line/area `TrendChart` over 30 buckets + a revenue comparison bar via `ComparisonChart` where data allows)
  - `revenue-chart.tsx` (cumulative revenue area `TrendChart`)
  - `activity-feed.tsx` (`Timeline`)
  - `upcoming-appointments.tsx`
  - `recent-conversations.tsx` (`DataTable`)
  - `notifications-bell.tsx` (header bell with unread count + dropdown)
  - `range-picker.tsx` (global 30d/90d control)
  - `dashboard-error.tsx` (error boundary per widget)
  - `empty-state` usage from `src/components/states.tsx` for a new-tenant first-run
- Shell changes in `src/app/(app)/layout.tsx`: `AppShell` + `SidebarNav` + `PageHeader`; `notifications-bell` mounted in the header.

### States (every widget)

- **Loading**: per-widget skeleton (`LoadingState` / `Skeleton`), `role="status"` + `aria-busy` — no full-page spinner.
- **Error**: per-widget `ErrorState` with retry (`dashboard-error.tsx` boundary); the rest of the dashboard still works.
- **Empty**: first-run `EmptyState` with guidance toward the first action, never "No data available".

### Responsive & accessibility

- KPI grid: 4-up on desktop → 2-up on tablet → 1-up on mobile; charts and tables scroll horizontally on phones.
- Charts keep the built-in `role="img"` + `aria-label` trend summary + visually-hidden data table (`src/components/charts.tsx`); tables use `tabular-nums` and `aria-sort`.
- Logical (`ms-`/`ps-`/`start-`/`end-`) utilities only (RTL); tokens only, no raw values; lucide icons; keyboard-reachable interactive rows.
- `RangePicker` labelled; notification bell uses `aria-expanded` + labelled dialog.

---

## AI Impact

**None.** No prompts, tools, or model calls. `COMPONENT_DESIGN.md §7` mentions onboarding checklists and "seed demo data for empty tenants" — the closest AI-adjacent item — and that is explicitly out of scope (see UI Impact; future milestone). Token/cost estimate: zero.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every dashboard query scoped via `forScope(scope)` with `Scope` built from the session's `organizationId` — never from a request param (`SECURITY_RULES.md`). |
| Branch scope | Dashboard reads org-level (`branchId: null`), all branches; branch selection is Milestone 18. |
| Data exposure | The dashboard returns aggregated, org-scoped numbers plus the current user's own notifications. No cross-tenant leakage by construction. |
| PII | Widgets show contact names and message fragments only for conversations in the active org, via the scoped client. |
| Cookie | `dashboard:range` is a benign UI preference: `SameSite=Lax`, max-age 1y, server-read. Never used for authorization. |

---

## Testing Strategy

- **Integration** (real Postgres via `forScope`, alongside `src/lib/db/*.integration.test.ts`): a new dashboard repository suite against seeded data — correct counts/deltas, tenant isolation (org A never sees org B), branch-org scope correctness, empty-org behavior, and the response-time aggregation. All unit tests under `src/features/dashboard/**/*.test.ts`.
- **Component** (`src/features/dashboard/components/*.test.tsx`, vitest + `vitest-axe`): each widget renders its loading, empty, error, and populated states; axe clean in both themes and both directions (following `src/components/*.test.tsx`).
- **E2E** (`tests/e2e/dashboard.spec.ts`, both projects): authenticated user sees seeded Northwind numbers; the four KPIs, chart, activity feed, and recent conversations render; navigating to the inbox doorway reaches a stub; date-range switch updates widgets; axe audit of `/dashboard` in both themes, both directions, desktop + mobile.
- **Unit**: `formatAxisNumber`/date-bucketing helpers; range cookie parse; delta/sentiment derivation.

**Exit gate** (per `MILESTONE_RULES.md` §6 and the PRD DoD): `npm run typecheck` (0), `npm run lint` (0 warnings/errors), `npm run test`, `npm run test:e2e`, `npm run build`, axe-clean dashboard, docs + `CHANGELOG.md` updated, `MILESTONE_05_COMPLETED.md` written, and each verification claim backed by an actually-run command (per taste: verified against reality, not taken at face value).

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Tenant leak from a missed `where` in a new query | Medium | Critical | All dashboard reads through `forScope(scope)`; integration test proves org A cannot read org B. |
| R-2 | KPI "today"/narrow-range numbers render empty on seeded tenants | High | Medium | KPIs chosen to aggregate across the seeded 120-day window (AD-2); 30d default, 90d alternative. |
| R-3 | Six widgets × five queries make the dashboard slow | Medium | Medium | Repository runs the aggregations; if one query underperforms, `EXPLAIN ANALYZE` evidence + a bounded optimization — not a raw-SQL rewrite (AD-1). |
| R-4 | Rewiring the shell breaks existing members/security pages | Low | High | The two settings pages render inside the new shell; their tests + a full E2E pass guard the change. |
| R-5 | "Everything is a doorway" creates dead-end 404 links | Medium | Medium | Doorways target `notFound()` stubs, not missing routes — a deliberate, tested stub (AD-6). |
| R-6 | Building detail pages leaks future-milestone scope | Medium | Medium | `notFound()` stubs only; the plan's scope guard (AD-6) is checked at review. |

---

## Deliverables Checklist

- [ ] `docs/milestones/MILESTONE_05_PLAN.md` — this plan, committed
- [ ] `src/features/dashboard/repositories/dashboard.repository.ts` + service
- [ ] `src/server/scope.ts` — `resolveScope(organizationId)`
- [ ] `src/features/dashboard/components/*` — widget components
- [ ] `src/app/(app)/dashboard/page.tsx` — real dashboard
- [ ] `src/app/(app)/layout.tsx` — shell rewired to `AppShell` + `SidebarNav` + `PageHeader`
- [ ] `src/app/api/dashboard/{range,notifications}/route.ts`
- [ ] Integration, component, and E2E tests per Testing Strategy
- [ ] Docs: `CHANGELOG.md`, README/architecture/API notes; `MILESTONE_05_PROGRESS.md` maintained throughout
- [ ] `MILESTONE_05_COMPLETED.md` — written only after all exit criteria pass

---

## 2026-08-23 Structural Review Amendment

- [x] Implement the plan's per-widget error boundary requirement using the installed
      Next.js component-level `unstable_catchError` API, with a retryable `ErrorState`.
- [x] Add a regression test proving one widget fallback does not replace its siblings.
- [x] Split the 310-line dashboard repository below the 300-line hard limit.
- [x] Re-run focused dashboard tests, E2E, static gates, and build.
