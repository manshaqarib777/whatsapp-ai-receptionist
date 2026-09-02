# Milestone 20 — Progress

Status: Completed
Started: 2026-08-24
Last updated: 2026-08-24

## Completed Tasks

- [x] Read exact Milestone 20 PRD scope and repository rules.
- [x] Audit inbox audio attachments, storage, composer, message rendering, AI providers,
  erasure registry, database worker patterns, and seed architecture.
- [x] Create the Milestone 20 technical plan.
- [x] Document and implement the additive voice schema and migration.
- [x] Implement local/OpenAI speech providers, the durable transcription worker,
  closed command interpreter, and scoped APIs.
- [x] Implement voice-note recording, transcript states, user-initiated speech, and
  command confirmation UI in the inbox.
- [x] Add realistic deterministic voice-note and completed-transcript seed data.
- [x] Pass unit, integration, component, E2E, security, accessibility, responsive,
  performance, drift, build, seed replay, and dependency gates.

## Pending Tasks

None.

## Issues

None.

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-24 | Durable transcription records and jobs. | Speech work is slow/retryable and transcript PII needs lifecycle controls. | Request-bound transcription; storing transcript only in UI state. |
| 2026-08-24 | Closed voice-command vocabulary. | Recognized audio is untrusted input. | Executing free-form commands or URLs. |

## Database Changes

Migration `20260824110000_voice_ai` applied to the local development database.

## API Changes

All routes documented in `docs/api/voice.md` are implemented.

## Breaking Changes

None.
