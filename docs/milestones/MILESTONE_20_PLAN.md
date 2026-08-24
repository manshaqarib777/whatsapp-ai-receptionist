# Milestone 20 — Voice AI

## Objective

Turn inbox voice notes into accessible, searchable text and let agents hear generated
replies or issue bounded voice commands. Local development remains deterministic;
live speech processing is isolated behind a configured provider adapter.

## Requirements

Voice AI

Speech

Voice Notes

Text To Speech

Speech To Text

Voice Commands

STOP

## Architecture Decisions

- Add a `voice` vertical slice and durable transcription records linked to the source
  message and attachment. Transcripts are PII and support redaction.
- Keep speech-to-text and text-to-speech behind a narrow adapter. The local adapter is
  deterministic and labelled demo-only; OpenAI may be selected only with a server key.
- Process transcription through a durable database job so uploads and requests do not
  block on model latency. Use idempotent source-attachment keys and bounded retries.
- Render transcript state beside existing voice-note audio controls. Text-to-speech is
  user initiated and never autoplays.
- Voice commands use a closed allow-list (search, open inbox, draft reply, stop) and
  require explicit user confirmation before any write; arbitrary recognized text is
  never executed as code or navigation.
- Follow installed Next.js 16.2 route-handler, data-security, and BFF guidance.

## Dependencies

- Upstream: Milestones 4, 6, 8, and 19.
- Existing package: OpenAI SDK (optional live provider).
- Browser capability: MediaRecorder/Web Speech where available, with typed fallback.

## Database Impact

- Add `transcriptions` with organization/branch/message/attachment scope, language,
  provider/model, status, transcript text, confidence, attempts, bounded error,
  timestamps, soft deletion, and redaction.
- One transcription per attachment guarantees idempotency. Worker indexes cover
  pending claims and message display.
- Additive migration; rollback drops only voice records and enums.

## API Impact

- `GET /api/voice/transcriptions/:messageId` returns the scoped transcript state.
- `POST /api/voice/transcriptions` queues an audio attachment for transcription.
- `POST /api/voice/speech` returns generated audio for bounded text input.
- `POST /api/voice/commands/interpret` maps bounded recognized text to a safe command.
- Conversation permissions apply; strict schemas, tenant scope, rate limits, and
  structured errors are mandatory.

## UI Impact

- Voice notes show pending/error/complete transcript states and a retry action.
- Composer gains an accessible record control with duration, cancel, and preview.
- Message text gains a user-initiated “Listen” action.
- A voice-command dialog shows the recognized phrase and interpreted action before
  confirmation. Unsupported browsers receive clear fallback copy.

## AI Impact

- Speech provider/model, latency, and confidence are recorded. Transcript text enters
  AI context only through the existing message path and remains subject to prompt and
  handover controls.
- Text length, audio size/duration, output duration, retry count, and provider timeout
  are bounded. Local mode makes no model calls.

## Security Considerations

- Audio and transcripts are PII: tenant scoped, never logged, redactable, and omitted
  from audit metadata.
- Validate MIME type, size, ownership, and stored attachment before queueing.
- No autoplay, hidden recording, arbitrary command execution, or external call in
  local mode. Microphone access begins only after a user gesture.

## Testing Strategy

- Unit: validators, command allow-list, local adapters, limits, state mapping.
- Integration: queue/claim/complete/fail/retry/idempotency, tenant/branch isolation,
  redaction, and erasure.
- Component: audio/transcript/record/command states, keyboard, RTL, and axe.
- E2E: seeded voice note transcription, generated speech, and confirmed safe command.
- Full gates: typecheck, lint, Vitest, Playwright, build, drift, and audit.

## Risks

1. **PII leakage:** fixed DTOs, scoped repositories, redaction, logger exclusions.
2. **Unsupported browser recording:** capability detection and upload fallback.
3. **Long/expensive media:** hard size/duration/text limits and queued work.
4. **Command injection:** closed semantic command map and confirmation boundary.
