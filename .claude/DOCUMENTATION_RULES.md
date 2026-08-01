# Documentation Rules

**Documentation is part of development**, not a follow-up task. A feature without
documentation is not complete.

---

## Always Update

On every change that alters behaviour or contracts:

- `README.md`
- Architecture docs — `/docs/architecture/`
- API docs — `/docs/api/`
- Database docs — `/docs/database/`
- Changelog — `.claude/CHANGELOG.md`

Documentation is written **before** implementation (step 4 of the execution order), then
corrected against reality before the PR is opened.

---

## Structure

```
docs/
├── PRODUCT_REQUIREMENTS.md       # REQUIREMENT SOURCE — read before development.
│                                 # The user's document. Do not edit to record
│                                 # progress or to justify scope changes.
├── milestones/
│   ├── MILESTONE_01_PLAN.md
│   ├── MILESTONE_01_PROGRESS.md
│   └── MILESTONE_01_COMPLETED.md
├── architecture/
│   ├── overview.md               # System diagram, data flow
│   ├── decisions/                # ADRs, ADR-0001-*.md
│   └── message-flow.md           # Inbound → AI → outbound, with retries
├── api/
│   └── <resource>.md             # One file per resource
├── database/
│   ├── schema.md                 # Current schema, generated + annotated
│   └── schema-change.md          # Required before any DB change
├── ai/
│   ├── prompts.md                # Prompt versions and rationale
│   └── evaluations.md            # Eval suite and results
└── runbooks/
    ├── webhook-failures.md
    ├── model-outage.md
    └── incident-response.md
```

---

## README.md

Required sections, in order:

1. What this is — two sentences.
2. Status — current milestone.
3. Tech stack.
4. Prerequisites.
5. Local setup — copy-pasteable, verified to work from a clean clone.
6. Environment variables — names and purpose. **Never values.**
7. Commands — dev, test, lint, build, migrate, seed.
8. Project structure.
9. Where the rules live (`.claude/`).
10. Deployment.

If a setup command in the README does not work from a clean clone, the README is a bug.

---

## API Documentation

One file per resource in `/docs/api/`. Per endpoint:

```markdown
### POST /api/conversations/:id/messages

Send a message in a conversation.

**Auth**: session required, role `agent` or `admin`
**Rate limit**: 60/min per tenant

**Request**
| Field | Type | Required | Notes |
|---|---|---|---|
| body | string | yes | 1–4096 chars |

**Response 201**
```json
{ "data": { "id": "...", "status": "pending" } }
```

**Errors**
| Code | Status | Cause |
|---|---|---|
| VALIDATION_FAILED | 400 | Body empty or too long |
| CONTACT_OPTED_OUT | 403 | Contact has opted out |
| RATE_LIMITED | 429 | Tenant limit exceeded |
```

Written before the route exists. Kept accurate; a wrong doc is worse than none.

---

## Database Documentation

`/docs/database/schema-change.md` — required before **any** schema change:

- New tables
- Relations
- Indexes (with justification)
- Migration strategy
- Rollback plan

`/docs/database/schema.md` — current state, with a note on every non-obvious column and
constraint. Explain *why* the unique constraint on `(tenant_id, whatsapp_message_id)`
exists, not just that it does.

---

## ADRs

Write one when a decision is non-obvious, contested, expensive to reverse, or deviates
from a documented default.

```markdown
# ADR-0004: Use Vercel Workflow for AI turns

Date: YYYY-MM-DD
Status: Accepted | Superseded by ADR-XXXX

## Context
The constraint or problem. Facts, not opinion.

## Decision
What we are doing.

## Consequences
What this makes easy. What it makes hard. What we accept.

## Alternatives Considered
Each with why it was rejected.
```

Numbered sequentially, never deleted. Superseded ADRs get a status line pointing
forward.

---

## Code Comments

- Explain **why**, never **what**.
- Document non-obvious constraints: Meta API quirks, retry semantics, race conditions,
  deliberate rule deviations.
- No commented-out code. Delete it.
- `TODO` requires an owner and a tracking reference, or it is not committed.
- JSDoc on exported services, tools, and public types: purpose, params, throws.

---

## Runbooks

For anything that will page someone. Each runbook: symptoms, how to confirm, immediate
mitigation, root-cause steps, escalation path. Written when the feature ships, not after
the first incident.

---

## Writing Standards

- Present tense, active voice, second person.
- Short sentences. No filler, no marketing language.
- Every code block copy-pasteable and verified.
- Absolute dates (`2026-03-14`), never "last week".
- State limitations honestly. A known limitation documented is engineering; one omitted
  is a trap.
