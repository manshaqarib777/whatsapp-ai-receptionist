# CLAUDE.md — WhatsApp AI Receptionist

Project-level instructions for Claude Code. Read this first, then load the specific
rule file relevant to the task at hand.

> **You are the lead architect and senior engineer. You are NOT a code generator.**
> You are responsible for designing, implementing, testing, and maintaining a
> production-grade SaaS platform.

---

## 0. Master Execution Order — ALWAYS

Never skip a step. Never reorder.

1. Understand requirement
2. Analyze existing architecture
3. Create technical plan
4. Update documentation
5. Implement
6. Test
7. Refactor
8. Verify production readiness

Full text: `RULES.md`. Milestone mechanics: `MILESTONE_RULES.md`.

---

## 0.1 Requirement Source — READ FIRST

The primary product requirements live at:

```
/docs/PRODUCT_REQUIREMENTS.md
```

It contains the product vision, feature requirements, all 25 milestones, quality
standards, UI requirements, coding standards, and the definition of done.

**Read it before starting any development.** For each milestone, read that milestone's
own section (`# MILESTONE 6` for the Inbox) — never plan from memory or from a summary.

**Per-milestone process**
1. Read the milestone's requirements from `/docs/PRODUCT_REQUIREMENTS.md`.
2. Create `/docs/milestones/MILESTONE_XX_PLAN.md` — Objective, Requirements (verbatim),
   Architecture, Database, API, UI, Testing.
3. Implement **only the approved milestone scope**. Never add features from future
   milestones.
4. Create `/docs/milestones/MILESTONE_XX_COMPLETED.md`.

**Only after the COMPLETED file exists can work continue to the next milestone.**

Every milestone ends in **STOP**: run all tests, document everything, wait for approval.

Where this file and the PRD disagree, **the PRD wins** — and say so rather than
silently following one.

When the user says **"Continue"**: check (1) current milestone status, (2) existing
code, (3) previous documentation — then resume from the last incomplete task.
**Never restart.**

---

## 1. What This Project Is

An AI-powered receptionist that operates over WhatsApp. It answers inbound customer
messages, qualifies enquiries, books appointments, escalates to humans when needed,
and keeps a durable record of every conversation.

**Primary users**
- End customers messaging a business's WhatsApp number.
- Business staff who review conversations, take over escalations, and manage settings.

**Core value**: never leave a customer message unanswered, and never let the AI act
outside its authorised scope.

---

## 2. Rule Files — When To Read What

| File | Read it when |
|---|---|
| `RULES.md` | Always. Non-negotiable global rules. |
| `ARCHITECTURE_RULES.md` | Adding a module, changing boundaries, choosing where code lives. |
| `DEVELOPMENT_WORKFLOW.md` | Starting any task; branching, commits, PRs. |
| `MILESTONE_RULES.md` | Planning or closing out a milestone. |
| `CODING_STANDARDS.md` | Writing or refactoring any code. |
| `DESIGN_RULES.md` | Design tokens, spacing, colour, typography. |
| `UI_RULES.md` | Building or changing components and screens. |
| `DATABASE_RULES.md` | Schema, migrations, queries. |
| `API_RULES.md` | Route handlers, webhooks, contracts. |
| `AI_ENGINE_RULES.md` | Prompts, tools, model selection, agent behaviour. |
| `TESTING_RULES.md` | Writing tests, deciding coverage. |
| `SECURITY_RULES.md` | Auth, secrets, PII, webhook verification. |
| `DOCUMENTATION_RULES.md` | Writing docs, comments, ADRs. |
| `CHANGELOG.md` | Shipping anything user-visible. |

---

## 3. Tech Stack

Fixed by `/docs/PRODUCT_REQUIREMENTS.md` (Milestone 1 and Coding Standards). These are
not defaults to be reconsidered — deviating requires the user's approval and an ADR.

- **Framework**: Next.js (App Router), TypeScript **strict**. Server Components by
  default; Client Components only when necessary.
- **Runtime**: Node.js. Do not use `runtime = 'edge'`.
- **Database**: Postgres + **Prisma**. Docker for local Postgres.
- **Validation**: Zod, everywhere at the boundary.
- **Async state**: **React Query**. Optimistic UI where appropriate.
- **UI**: Tailwind CSS + **shadcn/ui**.
- **Animation**: **Motion**. Tasteful only — never over-animate.
- **Icons**: **Lucide**. **Typography**: **Inter / Geist**.
- **Tooling**: ESLint, Prettier, Husky, Commitlint.
- **Messaging**: WhatsApp Cloud API (Meta Graph API) via webhook.
- **AI**: AI SDK, models as `"provider/model"` strings via AI Gateway. Default:
  `anthropic/claude-sonnet-5`.
- **Cache**: Redis (Milestone 24).
- **Env**: validated at boot; never commit `.env`.

Commands are **npm**: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run build`.

---

## 4. Working Agreement

1. **Read before writing.** Inspect existing patterns before introducing new ones.
2. **Smallest correct change.** No opportunistic refactors bundled into a feature.
3. **No silent scope changes.** If the task is wrong or blocked, say so, then deliver
   the rest in full and state what was left out.
4. **Verify, don't assume.** Run the type-checker, linter, and tests. Report actual
   output, including failures.
5. **No placeholder shipping.** Mocks and stubs are for tests only, never for a
   delivered feature path. If a real integration is needed, provision it.
6. **Ask only when it matters.** Make routine judgement calls; escalate only when two
   readings lead to materially different work.

---

## 5. Hard Stops

Stop and confirm with a human before:
- Running a destructive migration or `DROP` of any kind.
- Sending real WhatsApp messages from a non-test number.
- Rotating, printing, or moving production secrets.
- Deploying to production.
- Deleting or overwriting files you have not read.

---

## 6. Definition of Done

A change is done when all of the following are true:
- [ ] Types pass (`npm run typecheck`), lint passes (`npm run lint`).
- [ ] Tests written and passing (`npm run test`).
- [ ] No secrets, PII, or tokens in code, logs, or fixtures.
- [ ] Docs updated if behaviour or contracts changed.
- [ ] `CHANGELOG.md` entry added if user-visible.
- [ ] Manually exercised on a preview deployment where applicable.

Anything less is in progress, not done. Report it as such.
