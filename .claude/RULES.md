# RULES.md — Master Execution Rules

Authoritative. Everything in the other rule files elaborates on this; nothing
overrides it.

You are the lead architect and senior engineer. You are **NOT** a code generator.
You are responsible for designing, implementing, testing, and maintaining a
production-grade SaaS platform.

---

## 1. Execution Order — ALWAYS

1. **Understand requirement** — restate it. Identify what is unstated.
2. **Analyze existing architecture** — read the code before changing it.
3. **Create technical plan** — written, in `/docs/milestones/`.
4. **Update documentation** — before implementing, not after.
5. **Implement** — smallest correct change.
6. **Test** — unit, integration, component, E2E.
7. **Refactor** — remove duplication, fix layering, shrink oversized units.
8. **Verify production readiness** — types, lint, tests, security, performance.

**Never skip steps.** Skipping step 3 or step 6 is the most common failure; both are
non-negotiable.

---

## 2. Milestone Rule

This project is developed **milestone by milestone**.

The roadmap exists in `/docs/PRODUCT_REQUIREMENTS.md`.

- Complete milestones **sequentially**.
- **Never** start a future milestone before the current milestone is marked completed.
- A milestone is completed only when `MILESTONE_X_COMPLETED.md` exists and its
  checklist is satisfied.

See `MILESTONE_RULES.md` for the full lifecycle.

---

## 3. Before Any Coding

Create `/docs/milestones/MILESTONE_X_PLAN.md`.

```
docs/
 └── milestones/
      ├── MILESTONE_01_PLAN.md
      ├── MILESTONE_01_PROGRESS.md
      └── MILESTONE_01_COMPLETED.md
```

The plan must contain, as named sections:

- Objective
- Architecture decisions
- Dependencies
- Database impact
- API impact
- UI impact
- AI impact
- Security considerations
- Testing strategy
- Risks

**Only after creating the plan, start coding.**

---

## 4. During Development

Maintain `MILESTONE_X_PROGRESS.md`. Track:

- Completed tasks
- Pending tasks
- Issues
- Technical decisions
- Database changes
- API changes
- Breaking changes

Update it as work happens, not in a batch at the end.

---

## 5. After Completion

Create `MILESTONE_X_COMPLETED.md`. Include:

- What was built
- Files created
- Files modified
- Tests completed
- Performance results
- Known limitations

---

## 6. File Creation Rules

Before creating **any** file, ask:

1. Does this belong to an existing feature?
2. Can this logic be reused?
3. Is this the correct layer?

**Never create random files.** If you cannot answer all three, do not create the file.

---

## 7. Architecture Rule

Feature-first. Each business domain owns its stack:

```
features/
 └── inbox/
      ├── components/
      ├── hooks/
      ├── services/
      ├── validators/
      ├── types/
      ├── api/
      └── tests/
```

Shared code goes in:

```
src/
 ├── components
 ├── ui
 ├── lib
 ├── hooks
 ├── utils
 └── types
```

**Never put business logic inside components.** Details: `ARCHITECTURE_RULES.md`.

---

## 8. Component Rule

- Maximum **300 lines**. If bigger: **split**.
- Every component must have:
  - Clear responsibility
  - Typed props
  - Loading state
  - Error state
  - Empty state
  - Accessibility

Details: `UI_RULES.md`.

---

## 9. Database Rule

Before any database change, create `/docs/database/schema-change.md` explaining:

- New tables
- Relations
- Indexes
- Migration strategy
- Rollback plan

**Never directly modify production schema.** Details: `DATABASE_RULES.md`.

---

## 10. API Rule

Every API must have:

- Request validation
- Authentication check
- Authorization check
- Error handling
- Logging
- Documentation
- Tests

No exceptions, including internal and webhook routes. Details: `API_RULES.md`.

---

## 11. Testing Rule

Every feature requires:

- Unit tests
- Integration tests
- Component tests
- E2E tests

**Never mark complete without tests.** Details: `TESTING_RULES.md`.

---

## 12. Stop Conditions

**STOP immediately** when:

- Tests fail
- TypeScript errors exist
- Architecture conflict exists
- Security issue exists
- Missing requirement exists

**Do not continue and create more code.** Report the condition and wait.

---

## 13. Documentation Rule

Always update:

- `README.md`
- Architecture docs
- API docs
- Database docs
- Changelog

**Documentation is part of development**, not a follow-up task.
Details: `DOCUMENTATION_RULES.md`.

---

## 14. Final Command — "Continue"

When the user says **"Continue"**, check:

1. Current milestone status
2. Existing code
3. Previous documentation

Then continue from the last incomplete task. **Never restart.**
