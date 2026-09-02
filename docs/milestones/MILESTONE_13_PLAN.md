# Milestone 13 — Workflow Builder

Created: 2026-08-15
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 13`
Status: Draft for approval

---

## Objective

Build the Workflow Builder: a visual node-graph editor for automations with
triggers, conditions, actions, delays, and variables. The M4 schema already
designed `Workflow`, `WorkflowVersion`, `WorkflowRun`, and `WorkflowRunStep` —
the graph is JSON on the version row (`{ nodes, edges, conditions, variables }`
with a `triggerKind`), runs carry trigger entity context, and run steps have a
`scheduledFor` column for delay nodes. This milestone implements the service
layer, API, and UI on top.

True after this milestone, and not true now:

- Workflows are manageable per branch: create, rename, enable/disable, and a
  versioned edit history (the builder saves a new `WorkflowVersion` per save,
  never mutating a published graph in place).
- The visual builder edits a node graph: trigger node, condition branches,
  action nodes (send message, tag, assign, create task, delay), and variables —
  with the graph validated server-side before any version is stored.
- The validation is real: a node graph that references an unknown node id, has a
  condition edge that is not binary, or carries an invalid variable reference is
  refused (409) rather than saved.
- Runs exist: a workflow can be triggered manually (test run) and the run + step
  rows are written; delay steps carry `scheduledFor` so the scheduler (a later
  milestone's worker) can act on them.
- The `/workflows` UI lists workflows, opens a builder, toggles enablement, and
  shows the run history for a workflow.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits
  the workflow pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 13`:

```
Workflow Builder

Visual Builder

Triggers

Conditions

Actions

Delays

Variables

Templates

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/workflow-builder/` feature domain

```
src/features/workflow-builder/
  repositories/workflows.repository.ts    # only DB access; forScope everywhere
  services/workflows.service.ts           # orchestration: CRUD, versioning, enable/disable
  services/graph.ts                       # pure graph validation + node/edge typing
  validators/workflows.validators.ts      # zod schemas for all routes
  hooks/use-workflows.ts                  # React Query hooks + mutations
  components/workflow-list.tsx            # status-filtered list + create
  components/workflow-builder.tsx         # the visual graph editor
  components/workflow-node.tsx            # one node card in the canvas
  components/workflow-runs.tsx            # run history for a workflow
```

The feature directory is `workflow-builder` per `ARCHITECTURE_RULES.md` §5's
domain table. The repository is the only layer that touches the database; every
query runs through `forScope`. `Workflow`, `WorkflowVersion`, `WorkflowRun`, and
`WorkflowRunStep` are BRANCH-scoped, so writes derive a branch scope from the
default branch.

### AD-2 — The graph is JSON, validated by a pure function

The schema stores the whole graph as JSON on `WorkflowVersion.definition`. The
shape is fixed and typed in code:

```
definition: {
  nodes: [
    { id, type: 'trigger'|'condition'|'action'|'delay', actionKind?: 'send_message'|'tag'|'assign'|'create_task', config: {...} }
  ],
  edges: [ { id, from, to, label?: 'true'|'false' } ],
  variables: [ { name, value } ],
}
```

`validateGraph(definition)` is a **pure function** — unknown node/edge
references, a non-binary condition edge (a condition node must have exactly two
outgoing edges labelled `true` and `false`), duplicate node ids, and empty
graphs are all rejected before the version row is written. The server is the
authority; the client builder mirrors the same rules for live feedback only
(the quotations VAT-preview pattern).

### AD-3 — Versioned saves, immutable published graphs

Every save from the builder writes a new `WorkflowVersion` with an incremented
`versionNumber` and updates `Workflow.currentVersionId`. A version row is never
mutated after creation — the auditability is the point. Enabling a workflow
(`PATCH { isEnabled: true }`) requires at least one version; a workflow with no
versions cannot be enabled (409).

### AD-4 — Runs and the delay seam

`POST /api/workflows/[id]/runs` starts a manual (test) run against the current
version: it writes a `WorkflowRun` and a `WorkflowRunStep` per node in the
graph, evaluating conditions synchronously for the test path and marking delay
steps `pending` with `scheduledFor` set. A worker that executes due delay steps
is a later milestone (the DB-polled pattern is established by knowledge /
reminders / CRM workers); M13 owns the run journal and the step rows.

### AD-5 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/workflows` | GET | `workflow:read` | — | `{ workflows }` |
| `/api/workflows` | POST | `workflow:write` | `{ name }` | `{ workflow }` 201 |
| `/api/workflows/[id]` | GET | `workflow:read` | — | `{ workflow, versions, runs }` |
| `/api/workflows/[id]` | PATCH | `workflow:write` | `{ name?, isEnabled? }` | `{ workflow }` |
| `/api/workflows/[id]/versions` | POST | `workflow:write` | `{ definition, triggerKind }` | `{ version }` 201 |
| `/api/workflows/[id]/runs` | POST | `workflow:write` | — | `{ run }` 201 |

Cross-tenant or missing ids are 404, never 403. Invalid graphs are 409.

### AD-6 — Templates

"Templates" in the PRD maps to **saving a workflow as a reusable starting
point**: the builder has a "Save as template" action that stores the current
definition under a name (`workflow_templates` is not in the M4 schema, so
templates are `Workflow` rows flagged as templates in this milestone, or the
plan defers templates explicitly). The plan defers a dedicated template table:
**template support is the `definition` copy action in the builder UI**, and a
templated workflow is a new workflow seeded with a prior workflow's definition.
This matches the quotations precedent where template application at creation is
API-wired and UI later.

---

## Dependencies

No new packages. The graph editor is built with the existing primitives
(selects, inputs, buttons, cards) — a drag-drop library is deliberately not
added; node placement is list-ordered with explicit connectors (keyboard
reachable, axe-clean, and consistent with the M10 CRM board's button-not-drag
precedent).

**Upstream**: M4 schema (workflow tables), M10 CRM (tag/assign/task actions
reference CRM services), M11/M12 (money math precedent, PDF not needed).

## Database Impact

No schema changes. The M4 schema already provides `workflows`,
`workflow_versions`, `workflow_runs`, `workflow_run_steps` with the JSON graph,
`triggerKind`, run status enums, and `scheduledFor`. `schema-change.md` is
untouched.

## API Impact

New surface (AD-5). All routes follow the house envelope (`withApiHandler`,
`jsonSuccess`, Zod validation, correlation id). No breaking changes.

## UI Impact

- `/workflows` — workflow list (name, status, version count) with a create
  doorway and enable/disable toggle.
- `/workflows/[id]` — the builder: a node canvas (trigger → conditions →
  actions → delays) rendered as ordered cards with add/remove/reorder controls,
  a live validation summary, save-as-new-version, and a run-history section.
- States: loading/error/empty per the house component rules. Responsive and
  axe-clean (WCAG 2.2 AA). Keyboard-reachable throughout (no drag-drop).

## AI Impact

None in M13. The workflow builder is a deterministic configuration surface; the
AI engine's tool surface is untouched.

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; cross-tenant reads are 404 |
| Authorization | `workflow:read/write` enforced server-side |
| Graph injection | `definition` is validated by `validateGraph`; unknown node/edge ids and invalid variable refs are refused |
| Version integrity | Versions are immutable after creation; `currentVersionId` is the only pointer |

## Testing Strategy

- **Unit**: `validateGraph` (empty, unknown edge target, non-binary condition,
  duplicate ids, valid graph), version numbering, enable guards.
- **Component**: list/builder/run-history states (loading/error/empty/
  populated), add/remove node, axe-clean.
- **Integration** (real Postgres): create workflow, save version increments,
  invalid graph → 409, enable requires a version, manual run writes run + steps,
  delay step gets `scheduledFor`, **org A never sees org B**.
- **E2E**: seeded list, create workflow, add a node and save a version, enable,
  run history, axe clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep into a full drag-drop canvas | High | The builder becomes a framework project | Ordered-card canvas with connectors, no drag-drop library (M10 precedent) |
| Graph validation drift between client and server | Medium | Invalid graphs saved | Server is authoritative; client mirrors the same pure function; integration-tested 409 |
| Runs without a worker look inert | Medium | Users see pending steps | The run journal + step rows are real; execution lands with the scheduler milestone |
