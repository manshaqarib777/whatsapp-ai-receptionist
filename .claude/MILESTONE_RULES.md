# MILESTONE_RULES.md

---

## 1. Core Rule

This project is developed **milestone by milestone**. The roadmap exists in
`/docs/PRODUCT_REQUIREMENTS.md`.

- Milestones are completed **sequentially**.
- **Never** start a future milestone before the current milestone is marked completed.
- "Marked completed" means `MILESTONE_X_COMPLETED.md` exists and its exit criteria are
  all satisfied — not that the code appears to work.

**Step 1 of every milestone is to read that milestone's section in
`/docs/PRODUCT_REQUIREMENTS.md`.** Working on `MILESTONE 6 — Inbox` means reading the
`# MILESTONE 6` section there first. Never plan from memory or from this file's index.

Implement **only the approved milestone scope**. Never add features from future
milestones.

If a later milestone's work becomes urgent, that is a roadmap change. The PRD is the
user's document — raise the conflict and wait. Do not edit the PRD to justify jumping
ahead, and do not silently reorder.

---

## 2. Documents Per Milestone

```
docs/
 └── milestones/
      ├── MILESTONE_01_PLAN.md
      ├── MILESTONE_01_PROGRESS.md
      └── MILESTONE_01_COMPLETED.md
```

Zero-padded two-digit numbers. One set per milestone, never overwritten. Superseded
plans are amended in place with a dated note, not deleted.

---

## 3. Before Any Coding — `MILESTONE_X_PLAN.md`

Required sections, in this order. Empty sections are written as `None.` with a reason —
never omitted.

```markdown
# Milestone X — <Title>

## Objective
What is being built. What is true after this milestone that is not true now.
Measurable.

## Requirements
Copy the **exact** requirements from the `# MILESTONE X` section of
`/docs/PRODUCT_REQUIREMENTS.md`. Verbatim — do not paraphrase, do not trim, do not
add. Anything you believe is missing goes below as an open question, not silently
into scope.

## Architecture Decisions
Modules touched or created, layer placement, patterns chosen, alternatives rejected
and why. Link any ADR.

## Dependencies
New packages with justification. Upstream milestones. External services and the
credentials they need.

## Database Impact
New tables, columns, relations, indexes. Migration strategy. Rollback plan.
Link `/docs/database/schema-change.md`.

## API Impact
New/changed routes with method, path, auth, request shape, response shape,
error codes. Breaking changes and their migration path.

## UI Impact
Screens and components added or changed. States (loading/error/empty). Responsive
and accessibility considerations.

## AI Impact
Prompt changes, new tools, model selection, token/cost estimate, failure modes,
guardrails.

## Security Considerations
New attack surface. Auth/authorization changes. PII touched. Secrets required.
Rate limits. Tenant isolation impact.

## Testing Strategy
Unit / integration / component / E2E — what specifically gets covered, and the
edge cases that must be proven.

## Risks
Ranked. Each with likelihood, impact, and mitigation.
```

**Only after creating the plan, start coding.**

---

## 4. During Development — `MILESTONE_X_PROGRESS.md`

Updated continuously, as work happens.

```markdown
# Milestone X — Progress

Status: In Progress
Started: YYYY-MM-DD
Last updated: YYYY-MM-DD

## Completed Tasks
- [x] <task> — <commit/PR>

## Pending Tasks
- [ ] <task>

## Issues
| # | Issue | Status | Resolution |
|---|---|---|---|

## Technical Decisions
| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|

## Database Changes
| Migration | Description | Applied to |
|---|---|---|

## API Changes
| Route | Change | Breaking? |
|---|---|---|

## Breaking Changes
Description, who is affected, migration path.
```

Never mark a task complete before its tests pass.

---

## 5. After Completion — `MILESTONE_X_COMPLETED.md`

```markdown
# Milestone X — Completed

Completed: YYYY-MM-DD

## What Was Built
Narrative summary against the original objective. Note any scope change.

## Files Created
Full paths, grouped by feature, one line of purpose each.

## Files Modified
Full paths with the nature of the change.

## Tests Completed
| Type | Count | Coverage | Command |
|---|---|---|---|
Unit / Integration / Component / E2E. Note what is deliberately not covered.

## Performance Results
Measured, with method — not estimated.
- Webhook ack p50/p95
- AI first-token / full-response latency
- Key query timings
- Bundle size delta

## Known Limitations
Honest list. Each with impact and where it is tracked.
```

---

## 6. Exit Criteria

A milestone is complete only when **all** hold:

- [ ] Every task in `PROGRESS.md` is checked or explicitly deferred with a reason.
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run lint` — zero errors, zero warnings.
- [ ] Unit, integration, component, and E2E tests exist and pass.
- [ ] `npm run build` succeeds.
- [ ] Security review done against `SECURITY_RULES.md`.
- [ ] Docs updated: README, architecture, API, database.
- [ ] `CHANGELOG.md` entry added.
- [ ] Exercised on a preview deployment.
- [ ] `MILESTONE_X_COMPLETED.md` written.

Plus the PRD's Definition of Done (§8 below). `/docs/PRODUCT_REQUIREMENTS.md` is the
requirement source and is **not** edited to record progress — completion is recorded by
the `MILESTONE_XX_COMPLETED.md` file.

---

## 7. The Roadmap

25 milestones, defined in `/docs/PRODUCT_REQUIREMENTS.md`. Read the milestone's own
section there before planning it. This table is an index only — the PRD is the source
of truth for scope.

| # | Milestone | # | Milestone |
|---|---|---|---|
| 01 | Project Foundation | 14 | Broadcast System |
| 02 | Authentication | 15 | Analytics |
| 03 | Design System | 16 | Reviews |
| 04 | Database | 17 | Loyalty |
| 05 | Dashboard | 18 | Multi Branch |
| 06 | Inbox | 19 | Integrations |
| 07 | Knowledge Base | 20 | Voice AI |
| 08 | AI Engine | 21 | AI Agents |
| 09 | Appointment Engine | 22 | Admin Portal |
| 10 | CRM | 23 | Security |
| 11 | Quotation System | 24 | Performance |
| 12 | Invoices | 25 | Production |
| 13 | Workflow Builder | — | Final QA |

**Ordering constraints from the PRD**
- Milestone 03 (Design System) is built **before any pages**. "Only after Design System
  is approved proceed."

**Milestone 03 carries debt from Milestone 01** that must be cleared before any
component is authored:
- Set `--radius: 1rem` (currently 10px, documented as 16px) — `DESIGN_TOKENS.md` §6.
- Add `--success`, `--warning`, `--info` tokens with `-subtle` and `-foreground`
  variants — referenced by `DESIGN_RULES.md`, absent from `globals.css`.
- Replace the greyscale `--chart-1…5` placeholders with a real categorical palette —
  `COMPONENT_DESIGN.md` §8.
- Add `--shadow-*` and `--z-*` scales — `DESIGN_TOKENS.md` §4, §5.
- Add the no-flash theme script and the `prefers-reduced-motion` CSS reset.
- Add the ESLint rule forbidding physical direction utilities — `RTL_I18N_RULES.md` §5.
- Add `vitest-axe` and an RTL Playwright project to the test setup.
- Every milestone ends in **STOP** — verify, document, wait for approval.
- **Never add features from future milestones.** Implementing Inbox AI suggestions
  (M06) does not license building the AI Engine (M08).

---

## 8. Definition of Done (from the PRD)

A milestone is complete only when **all** hold:

- [ ] All acceptance criteria are met.
- [ ] Tests pass (unit, integration, component, E2E).
- [ ] Build succeeds with zero errors.
- [ ] Lint and type checks pass — 0 errors, 0 warnings.
- [ ] Performance budget maintained: First Paint, Largest Paint, bundle size,
      hydration, memory. No major regressions.
- [ ] Accessibility satisfied: keyboard navigation, focus states, ARIA, screen reader,
      contrast.
- [ ] Responsive verified: desktop, laptop, tablet, mobile, ultra-wide.
- [ ] Documentation updated: README, architecture, API docs, database docs, changelog.
- [ ] Code reviewed and refactored.
- [ ] No known bugs remain.
- [ ] Dummy data covers realistic business scenarios.
- [ ] UI matches premium Framer-quality standards (`DESIGN_RULES.md`).

Only then proceed to the next milestone.

---

## 9. Mid-Milestone Stop Conditions

Stop and report, per `RULES.md` §12:

- Tests fail
- TypeScript errors exist
- Architecture conflict exists
- Security issue exists
- Missing requirement exists

Record it in `PROGRESS.md` under **Issues** before stopping. Do not continue and
create more code.
