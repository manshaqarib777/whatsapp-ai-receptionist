# Milestone 21 — AI Agents

## Objective

Turn the single reception-oriented AI engine into a configurable, branch-scoped team
of bounded specialist agents. Each specialist has an explicit purpose, prompt version,
tool allow-list, activation state, and deterministic local behavior.

## Requirements

AI Agents

Reception Agent

Sales Agent

Support Agent

Marketing Agent

Analytics Agent

Billing Agent

Manager Agent

Knowledge Agent

STOP

## Architecture Decisions

- Add agent definitions inside the existing `ai` vertical slice; do not create eight
  duplicate engines. A typed specialist catalog supplies immutable capabilities while
  tenant records supply activation, display configuration, and prompt selection.
- Route every turn through a deterministic specialist router, then reuse the proven
  classifier, memory, guardrail, provider, run-recorder, and tool-registry pipeline.
- Tool access is the intersection of the server catalog and the agent record. Client
  input cannot grant capabilities or choose tenant scope.

## Dependencies

- Upstream: Milestones 6, 8–17, 19, and 20.
- No new package or external credential. Existing local/OpenAI provider seam remains.

## Database Impact

- Add branch-scoped AI agent definitions with a closed specialist kind, status,
  prompt-template relation, safe configuration, timestamps, and soft deletion.
- Unique branch/kind identity and list/status indexes. Additive migration; rollback
  removes only agent records and their enum.

## API Impact

- `GET /api/ai/agents` lists safe agent DTOs for the active branch.
- `GET/PATCH /api/ai/agents/:id` reads and updates bounded configuration.
- `POST /api/ai/agents/:id/test` runs a deterministic, non-delivering test turn.
- Existing run/job routes remain compatible and gain selected-agent metadata.

## UI Impact

- Add an AI Agents management surface with cards for all eight specialists, active and
  disabled states, bounded editing, a test panel, loading/error/empty states, mobile
  layout, dark mode, RTL, keyboard operation, and WCAG 2.2 AA semantics.

## AI Impact

- Specialist selection is deterministic and auditable. Each agent receives only its
  catalogued prompt role and tools. Unknown/low-confidence work falls back to Reception
  or human escalation. Local mode remains deterministic and makes no model call.

## Security Considerations

- Derive organization and branch from the verified session. Return fixed DTOs, validate
  every mutation, restrict management to `ai:manage`, and never expose full prompts or
  provider secrets. Prompt injection, output sanitization, rate limits, confirmation
  gates, and PII-safe logging remain mandatory.

## Testing Strategy

- Unit: catalog, router, capability intersection, validation, fallback, and guardrails.
- Integration: CRUD, branch/tenant isolation, prompt ownership, soft deletion, and run
  attribution.
- Component: list/edit/test states, RBAC, keyboard, RTL, and axe.
- E2E: seeded specialist inventory, configuration, deterministic test run, desktop and
  mobile. Then run all repository gates.

## Risks

1. **Privilege expansion** — high impact; immutable server capability ceilings.
2. **Wrong specialist routing** — medium impact; deterministic rules and safe fallback.
3. **Prompt/config leakage** — high impact; fixed DTOs and no raw prompt bodies.
4. **Duplicated engine logic** — medium impact; one orchestrator with specialist context.
