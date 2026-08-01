# Coding Standards

From the PRD's Coding Standards section:

- Strict TypeScript only.
- No `any` unless justified.
- Zod for validation.
- Feature-based architecture.
- SOLID principles.
- Repository + service patterns.
- Reusable hooks.
- Small components.
- Comprehensive error boundaries.
- React Query for async state.
- Optimistic UI where appropriate.
- Server Components by default; Client Components only when necessary.
- Clean commit messages.
- No duplicated logic.
- JSDoc where complexity warrants it.

The rest of this file is how those are applied here.

---

## Language

TypeScript only. `strict: true`. No `@ts-ignore`, no non-null `!` assertions.

`any` requires a written justification comment on the line. "I'll fix it later" is not
one. Use `unknown` at boundaries, then narrow with a Zod schema.

---

## Naming

```
conversation.controller.ts
conversation.service.ts
conversation.repository.ts
conversation.validator.ts
conversation.types.ts
conversation.test.ts

ConversationThread.tsx        // components: PascalCase
useConversation.ts            // hooks: use + camelCase
formatPhoneNumber.ts          // utils: verb + noun
```

- Types and components: `PascalCase`
- Functions, variables, hooks: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Booleans read as assertions: `isLoading`, `hasConsent`, `canEscalate`
- No abbreviations. `conversation`, not `conv`.

---

## Functions

- One responsibility. If the name needs "and", split it.
- Maximum 50 lines. Maximum 4 parameters — beyond that, pass an object.
- Return early. No `else` after `return`.
- Maximum nesting depth 3.
- Pure where possible. Side effects live in services and repositories.

---

## Files

- Maximum 300 lines. If bigger: split.
- One primary export per file.
- Import order: node → external → internal aliases → relative → types.
- No barrel files that re-export everything; explicit imports only.

---

## Types

- Define types next to the layer that owns them, in `*.types.ts`.
- Prefer `type` for unions and objects; `interface` only when extending.
- No structural duplication — derive with `Pick`, `Omit`, `Awaited`, `z.infer`.
- Every external payload gets a Zod schema. Types are inferred from the schema, never
  hand-written alongside it.

---

## Errors

- Never swallow an error. Never `catch {}`.
- Throw typed domain errors, not strings:
  `NotFoundError`, `ValidationError`, `UnauthorizedError`, `RateLimitError`,
  `UpstreamError`.
- Catch only where you can act. Otherwise let it bubble to the controller boundary.
- Log with context (`tenantId`, `conversationId`, `messageId`) — never with PII or
  message bodies.

---

## Async

- `async/await` only. No raw `.then()` chains.
- Every external call has an explicit timeout.
- Parallelise independent work with `Promise.all`. Use `Promise.allSettled` when
  partial failure is acceptable.
- No unhandled floating promises.

---

## Client Async State — React Query

- **All** server state goes through React Query. No `useEffect` + `fetch` + `useState`.
  No server data duplicated into Zustand/Context.
- Query keys are structured and centralised per feature
  (`conversationKeys.list(tenantId, filters)`), never inline string arrays — otherwise
  invalidation silently misses.
- Mutations invalidate precisely. Blanket `invalidateQueries()` is a performance bug.
- Optimistic updates where the outcome is near-certain (sending a message, toggling a
  label): apply, then roll back on error with the previous snapshot. Never leave the UI
  showing a state the server rejected.
- Set `staleTime` deliberately per query. The default of 0 will hammer the API.

---

## Error Boundaries

Comprehensive, per the PRD:

- One at the root, one per route segment, one around any independently-failing widget
  (a chart, the AI suggestion panel, an embedded calendar).
- A boundary renders a real recovery UI — what failed, and a retry — never a blank
  screen or a raw error.
- One widget failing must never blank the page. A failing chart shows a failed chart;
  the dashboard around it still works.
- Boundaries report to the logger with context. Swallowing silently is worse than
  crashing.

---

## Forbidden

- `useEffect` + `fetch` for server data — use React Query.
- `console.log` in committed code — use the logger.
- Magic numbers and strings — name them.
- Commented-out code — delete it.
- `TODO` without an owner and a tracking reference.
- Direct database access outside a repository.
- Business logic inside a component or a controller.
- Mutating function arguments.
- `process.env` read anywhere except `src/lib/env.ts` (validated at boot).

---

## Comments

Explain **why**, never **what**. If the code needs a comment to say what it does,
rename things instead.

Document non-obvious constraints: Meta API quirks, retry semantics, race conditions,
deliberate deviations from a rule.

---

## Formatting

Prettier and ESLint are authoritative. Never hand-format against them, never disable a
rule inline without a one-line justification comment.
