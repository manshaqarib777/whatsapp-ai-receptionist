# Voice API

All endpoints require a database-backed session, trusted organization/branch scope,
the stated conversation permission, strict validation, correlation ids, and the
standard response envelope. Audio and transcript text are PII and never logged.

| Method | Route | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/voice/transcriptions/:messageId` | `conversation:read` | Read the scoped transcription state for a voice message. |
| `POST` | `/api/voice/transcriptions` | `conversation:write` | Idempotently queue a stored audio attachment. |
| `POST` | `/api/voice/speech` | `conversation:read` | Generate bounded speech audio from text. |
| `POST` | `/api/voice/commands/interpret` | `conversation:write` | Interpret recognized text as a closed, non-executing command proposal. |

The transcription worker is started with `npm run voice:work`. Local speech mode is
deterministic and makes no external request. Live speech requires a configured
server-side provider key.
