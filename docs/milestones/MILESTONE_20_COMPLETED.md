# Milestone 20 — Completed

Completed: 2026-08-24

## What Was Built

- Durable, tenant- and branch-scoped transcription records with idempotent queueing,
  bounded retries, `SKIP LOCKED` worker claims, redaction, and contact-erasure support.
- Deterministic local speech-to-text/text-to-speech plus an opt-in OpenAI adapter that
  fails configuration validation when its server key is absent.
- Strict transcription, speech, and closed-vocabulary command APIs with fixed DTOs,
  authorization, ownership checks, audio/text limits, and no arbitrary execution.
- Accessible inbox voice recording, transcript loading/error/retry states,
  user-initiated playback, and explicit confirmation for reply-drafting commands.
- Repeatable demo audio and a completed transcript for the Northwind inbox journey.

## Verification

- TypeScript, ESLint, schema drift, repeat seed, and production build passed.
- 104 Vitest files, 993/993 tests passed.
- 242/242 Playwright tests passed across desktop and mobile in 7.2 minutes.
- Focused seeded voice E2E and accessibility checks passed.
- `npm audit --audit-level=high --omit=dev`: 0 vulnerabilities.

## Safety Boundary

Local development makes no model call. Recording begins only after a user gesture,
speech never autoplays, transcript PII is scoped and redactable, and recognized text
can only produce a bounded proposal; write-capable commands require confirmation.
