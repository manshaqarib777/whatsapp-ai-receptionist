# Milestones 1–18 verification audit

Date: 2026-08-23
Scope: PRD requirements, milestone plans/progress/completion reports, production code,
schema/migrations, API/UI surfaces, workers, and automated-test coverage.

## Final re-certification — supersedes the initial findings below

The initial audit was retained below as the defect-discovery record. Those findings
were then repaired sequentially, milestone by milestone. Milestones 1–18 now have
plans, progress records, completion certificates, implementation evidence, and current
automated verification. External transports/connectors explicitly assigned to M19 are
fail-closed and are not represented as delivered integrations.

| Milestone | Final status | Re-certification result |
|---|---|---|
| 1 — Foundation | Complete | Reproducible build, local assets, CI/security/error boundaries verified. |
| 2 — Authentication | Complete | Durable lockout, invitation/session flows, tenant-safe repository boundary verified. |
| 3 — Design system | Complete | Shared states, accessibility, RTL/dark/responsive matrix verified. |
| 4 — Database | Complete | Default-branch invariant, scoped persistence, migrations and drift verified. |
| 5 — Dashboard | Complete | Query/service structure, widget resilience and real metrics verified. |
| 6 — Inbox | Complete | Assignment, notes, attachment security, mutations and tenant isolation verified. |
| 7 — Knowledge | Complete | Ingestion/version approval/retrieval, parser hardening and worker boundary verified. |
| 8 — AI engine | Complete | Durable jobs, engine/provider split, guardrails, tools and evaluations verified. |
| 9 — Appointments | Complete | DST-safe scheduling, recurrence, reminders and service updates verified. |
| 10 — CRM | Complete | Company subjects/routes, automation and structural splits verified. |
| 11 — Quotations | Complete | Lifecycle, snapshots, branding and valid PDF generation verified. |
| 12 — Invoices | Complete | Payment ledger, manual settlement, refunds, PDF and fail-closed gateways verified. |
| 13 — Workflows | Complete | Conditions, durable delayed continuation, graph rules and cloning verified. |
| 14 — Broadcast | Complete | Scheduled materialization and acknowledgement-gated recipient state verified. |
| 15 — Analytics | Complete | Range, captured payments, mature retention and bounded query structure verified. |
| 16 — Reviews | Complete | Acknowledgement-gated requests, durable retry and fail-closed adapters verified. |
| 17 — Loyalty | Complete | Atomic points, invoice-applied coupons, referrals and repository splits verified. |
| 18 — Multi branch | Complete | Trusted session branch, management UI/API and appointment/knowledge/AI isolation verified. |

Final repository gate on 2026-08-23:

- TypeScript and ESLint passed with zero warnings.
- 97 Vitest files, 979/979 tests passed.
- 238/238 Playwright tests passed across desktop and mobile in 7.3 minutes.
- Prisma deploy and drift checks passed; only documented non-expressible HNSW/trgm
  indexes remain.
- Next.js 16.2.12 production build passed with 59 generated pages.

## Initial audit snapshot (historical)

## Verdict

The repository contains substantial working functionality, but the milestone ledger is
not reliable as a completion gate. Only Milestones 5, 10, and 15 are close enough to
their stated PRD scope to be called implemented (with follow-up work). Fourteen of the
seventeen milestones need either missing product behavior, structural repair, or fresh
verification before they should be treated as complete. Milestone 8 has no completion
report at all, yet Milestones 9–17 were started and marked complete.

Ratings used below:

- **Implemented with follow-up**: the PRD surface exists; remaining defects are not the
  central feature.
- **Partial**: meaningful implementation exists, but one or more stated requirements or
  mandatory gates are missing.
- **Not complete**: a central requirement is a stub, deliberately deferred, or unsafe.

## Milestone matrix

| Milestone | Rating | Verified implementation | Completion blockers |
|---|---|---|---|
| 1 — Foundation | **Partial** | Next application, TypeScript, Tailwind/shadcn base, Vitest, Playwright, Prisma, CI, environment validation and logging exist. | The current production build is not reproducible offline because `next/font/google` downloads Geist. Preview verification was explicitly deferred. Completion evidence is historical, not a reproducible release artifact. |
| 2 — Authentication | **Partial** | Better Auth flows, credentials, invitations, memberships, roles, permissions, sessions, rate limiting and audit logging are present. | OAuth was recorded as unverified, invitation acceptance lacks a complete user-facing flow, progressive lockout was omitted, and organization creation does **not** create the default branch claimed by M4. Auth services also bypass the repository boundary. |
| 3 — Design system | **Partial** | Tokens, RTL/dark mode, component gallery, responsive shell and a broad component-test suite exist. | Preview and visual-regression approval were not completed. Several components are demonstrations backed by intentionally stubbed ports. The app route group lacks shared `loading.tsx` and `error.tsx` boundaries. |
| 4 — Database | **Partial** | A large tenant-aware schema, migrations, seeds, scoped Prisma wrapper, erasure path, ER documentation and isolation tests exist. | The PRD's “every table” claim was narrowed by deferring later feature tables. RLS was deferred, leaving the scoped wrapper as the only tenant control. The completion report's automatic-default-branch claim is false for `organization.service.ts`. Direct Prisma access remains outside repositories. |
| 5 — Dashboard | **Implemented with follow-up** | Real tenant-scoped KPIs, charts, activity, appointments and conversations are wired through API/service/repository layers with tests. | The PRD wording includes more dashboard categories than the delivered composition, and notifications use direct component fetching/error swallowing instead of the established query/service pattern. Reconfirm current E2E/build evidence. |
| 6 — Inbox | **Partial** | Conversation list/thread, polling, search/filtering, read state, typing state, labels, notes, archive/pin, assignment mutation, attachments/audio display, emoji, summaries and suggestions exist. | “Real-time” is polling rather than a push channel; outbound/inbound WhatsApp transport is not demonstrated. Assignment UI is documented as a dropdown stub. Suggestions and summaries are heuristic rather than the subsequently built AI engine. |
| 7 — Knowledge base | **Not complete** | File/FAQ/website ingestion, parsing, chunking, embedding/search, version/approval and retrieval are implemented and tested. | Notion and Google Docs—explicit PRD sources—were explicitly deferred. OCR and external-source behavior are not demonstrated end-to-end. The milestone was nevertheless marked complete. |
| 8 — AI engine | **Re-certified complete 2026-08-23** | Provider gateway, retrieval tools/citations, safety guardrails, bounded retry, deterministic evaluations, and a durable PII-minimizing message-reference queue with crash recovery are implemented. Focused tests, drift, build, desktop/mobile E2E, and axe pass. | No M8 blocker remains. External provider quality and operations remain deployment concerns, not missing milestone structure. |
| 9 — Appointments | **Re-certified complete 2026-08-23** | Services/resources, IANA/DST availability, DB-enforced conflicts, booking/cancel/reschedule, linked recurrence, reminder scheduling/acknowledgement boundary, calendar UI, and service update API are implemented. Focused tests, drift, build, and desktop/mobile E2E/axe pass. | Meta delivery configuration remains correctly assigned to M19; until configured, reminders fail visibly rather than claim delivery. |
| 10 — CRM | **Re-certified complete 2026-08-23** | Contacts/companies, pipelines/stages/deals, activities/timelines, tasks, polymorphic tags, automation and UI/API layers are implemented. Company subject integrity and dynamic routing were repaired; hooks are below the structural target. Focused tests, drift, build, and 10 desktop/mobile E2E/axe checks pass. | No M10 blocker remains. |
| 11 — Quotations | **Re-certified complete 2026-08-23** | Quote generation, stored VAT math, templates, guarded approval lifecycle, exact version snapshots, branded multi-page PDF output, tracking UI, and tenant isolation are implemented. The PDF object graph and ignored primary color were repaired; focused tests, drift, build, and 10 desktop/mobile E2E/axe checks pass. | Embedded logo images are not part of the delivered branding subset; colors/footer are real. Customer delivery channels remain an integrations concern. |
| 12 — Invoices/payments | **Core re-certified; integrations partial** | Invoice lifecycle, stored VAT, quote conversion, Stripe checkout/webhook, idempotent payment/refund journals, receipts, manual settlement, valid multi-page PDF, UI and isolation are implemented. Manual payment integrity was repaired; focused tests, drift, build, and 12 E2E/axe checks pass. | HyperPay, PayTabs, STC Pay and Apple Pay remain intentionally fail-closed until the external-integration milestone (M19). They must not be represented as configured. |
| 13 — Workflow builder | **Not complete** | Graph editor/validation, persisted definitions/runs, trigger/action/delay node types and test coverage exist. | Runtime condition nodes always follow the true branch; delayed nodes are persisted but no scheduler resumes them; templates are explicitly deferred. This is a visual definition recorder, not the complete automation engine described by the PRD. |
| 14 — Broadcast campaigns | **Not complete** | Segments, templates, campaigns, scheduling, recipients and analytics/status UI exist. | The worker performs no WhatsApp send but marks recipients `sent`; Meta approval is modeled locally rather than integrated. Delivery analytics therefore represent simulated state, which violates the no-placeholder shipping rule. |
| 15 — Analytics | **Implemented with follow-up** | Analytics pages and APIs cover conversations, response/performance, appointments, revenue, leads, campaigns, retention and forecasting with tests. | Some metrics are documented proxies/derived estimates and forecasting is deliberately crude. They need product validation and truthful UI labels, plus fresh E2E/build verification. |
| 16 — Reviews | **Not complete** | Platform/request/review persistence, UI, automation worker, manual capture and tests exist. | Google and Facebook adapters are explicit stubs. Review-request delivery is also a no-op that marks requests sent. The core integration/automation promise is therefore absent. |
| 17 — Loyalty | **Partial** | Programs, accounts, tiers, points ledger, rewards/redemption, referrals, coupons, worker and broad tests exist in the current uncommitted worktree. | Coupons are recorded but are not applied to checkout/invoices. The completion report claims build/E2E success that has not been reproduced in the current tree; the current build is font-network blocked. This milestone is also built on an unresolved M8 gate. |

## Cross-cutting structural findings

1. **The sequential milestone contract was broken.** M8 is incomplete and has no
   completion document, while M9–M17 have completion documents.
2. **Completion reports confuse implementation with a seam.** Workers in M9, M14 and
   M16 mark messages or recipients sent without delivering them; M12 exposes gateways
   that only reject calls; M13 records delayed execution without executing it.
3. **Historical test statements are overstated.** M9–M11 cite 185/186 E2E runs while
   using “all pass” language. Multiple later reports repeat build/E2E claims that are
   not currently reproducible.
4. **Layer boundaries are inconsistent.** Direct Prisma access exists in auth services,
   health/invoice paths, auth context and a knowledge adapter. Several route handlers
   contain controller logic despite the documented feature-controller structure.
5. **Frontend data access is inconsistent.** Some client components fetch directly and
   use effects instead of the shared TanStack Query hook pattern.
6. **The organization/branch invariant is not enforced.** The schema and documentation
   assume a default branch, but normal organization creation only creates the
   organization and membership.
7. **Maintainability limits are routinely exceeded.** Multiple production files are
   above the repository's stated 300-line target, concentrating orchestration, mapping
   and UI state in single modules.
8. **Route-level resilience is incomplete.** The authenticated route group does not
   provide common error/loading boundaries.

## Recommended recovery order

1. Correct the milestone ledger: reopen M1–M4 where gates are unverified, remove false
   “all pass” statements, and mark M7–M9 and M12–M17 partial/not complete.
2. Finish the platform spine: reproducible local fonts/build, default-branch atomic
   creation, repository enforcement, route boundaries, and a fresh full test/E2E run.
3. Complete M8 before new feature milestones: durable execution, privacy controls,
   E2E evidence and an honest completion report.
4. Replace false delivery state with real transport or an explicit `queued/unconfigured`
   state. Never mark a no-op send as `sent`.
5. Finish missing external requirements in dependency order: WhatsApp transport, then
   reminders/broadcast/review delivery; payment gateways; external knowledge/review
   connectors; workflow condition/delay runtime; coupon application.
6. Only then resume Milestone 18. Its plan/progress files should remain paused until the
   earlier gates are reconciled.

## Evidence notes

This audit is based on the repository state on the date above. “Implemented” means the
relevant production path and supporting tests were found; it does not treat a checked
box or a historical completion narrative as proof. External integrations were rated
incomplete when the production adapter is a no-op or throws an unconfigured error,
even if the seam and tests exist.

Current local verification on 2026-08-23:

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run test -- --run`: 86 files, 926 tests passed.
- `npm run build`: previously attempted on this worktree and blocked when
  `next/font/google` could not download Geist; this is a reproducibility failure, not a
  TypeScript/application compile diagnosis.
- Current E2E suite: not treated as passing without a fresh run against a successful
  production build.
