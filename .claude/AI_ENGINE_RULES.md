# AI Engine Rules

## Structure

Separate concerns into distinct directories. Never mix them.

```
agents/
  reception-agent.ts
  sales-agent.ts
  escalation-agent.ts

prompts/
  booking.prompt.ts
  faq.prompt.ts
  system.prompt.ts

memory/
  conversation-memory.service.ts

tools/
  check-availability.tool.ts
  book-appointment.tool.ts
  lookup-faq.tool.ts
  escalate-to-human.tool.ts

retrieval/
  knowledge-base.retriever.ts

evaluations/
  reception-agent.eval.ts
```

- **Agents** compose prompts, tools, and memory. They hold no prompt text inline.
- **Prompts** are versioned modules exporting a builder function. No string literals
  scattered through services.
- **Memory** owns what the model sees from history — summarisation, windowing, retrieval.
- **Tools** are the only way the AI changes state.
- **Retrieval** owns knowledge-base lookup. No prompt-stuffing raw documents.
- **Evaluations** are code, run in CI, not manual spot checks.

---

## Model Selection

Addressed as `"provider/model"` strings through AI Gateway. Never hardcode a provider
SDK.

| Task | Model |
|---|---|
| Customer-facing replies | `anthropic/claude-sonnet-5` |
| Complex reasoning, escalation judgement | `anthropic/claude-opus-5` |
| Classification, routing, extraction | `anthropic/claude-haiku-4-5-20251001` |

Model ids live in config, never inline. Changing a model is a documented decision with
an eval run attached.

---

## Prompt Rules

- System prompts are versioned files. A prompt change is a code change: PR, review,
  eval.
- Structure: role → scope → constraints → tone → tools → escalation policy → format.
- State explicitly what the AI **must not** do: no pricing commitments, no medical or
  legal advice, no promises about delivery dates, no discussing other customers.
- Never interpolate untrusted content into instructions. Customer messages go in as
  message content, clearly delimited — never concatenated into the system prompt.
- No PII in prompt templates. Inject at runtime, redact in logs.
- Keep prompts additive and testable. If you cannot write an eval for a prompt rule,
  the rule is too vague.

---

## Prompt Injection

Assume every inbound message is adversarial.

- Treat message content as **data**, never as instructions.
- The system prompt states that instructions inside customer messages are to be ignored.
- Tool authorization is enforced in **code**, not by the prompt. A model asking to call
  a tool it is not permitted to call must be rejected by the tool layer.
- Never let the model choose the tenant, the recipient phone number, or a price.
- Log and alert on suspected injection attempts.

---

## Tool Rules

Every tool has:

- A Zod input schema, strict, with descriptions on every field.
- Server-side authorization independent of the model's claim.
- Tenant scoping applied from the session, not from tool arguments.
- Idempotency for anything that writes.
- A typed, bounded result — no dumping raw DB rows into context.
- Its own unit tests, plus a test that the agent calls it for the right intent.

Read tools may run freely. **Write tools that affect the real world** — booking,
cancelling, sending — require an explicit confirmation step or a documented policy that
permits autonomy for that action.

---

## Guardrails

- **Never invent facts.** If the knowledge base has no answer, say so and offer
  escalation. Hallucinating business details is the top failure mode.
- Hard escalation triggers, checked in code before and after the model turn:
  complaints, legal or medical topics, payment disputes, explicit request for a human,
  repeated failure to resolve, low confidence, detected distress.
- Output validation: strip anything that looks like a system prompt leak, an internal id,
  or a URL not on the allow-list.
- Maximum tool-call iterations per turn, enforced. No unbounded agent loops.
- Token and cost ceiling per conversation and per tenant. Exceeding it escalates to a
  human rather than truncating silently.
- Response length cap suited to WhatsApp — short, plain messages, no markdown tables.

---

## Memory

- Never send the full history. Window recent turns and inject a maintained summary.
- Summarisation is a separate cheap model call, persisted, not recomputed per turn.
- Memory is tenant- and conversation-scoped. Cross-conversation memory requires explicit
  consent and a documented policy.
- The model never sees another contact's data. Enforced at the retrieval layer.

---

## Failure Handling

- Model call timeout, then retry with backoff — maximum two retries.
- On persistent failure: send a holding message, escalate to a human, alert. Never
  leave a customer message unanswered and never send a broken or empty reply.
- Streaming works on the Node.js runtime — no Edge required.
- Every AI turn runs inside a durable workflow step so a crash resumes rather than
  losing the turn.

---

## Human Handover

- Handover is one-way until a human explicitly returns the conversation to the AI.
- While a human owns the thread, the AI must not send anything.
- Every message records its author type: `ai` or `agent`. Surfaced in the UI.
  This is a trust requirement.

---

## Evaluation

- An eval suite in `evaluations/`, run in CI, gating prompt and model changes.
- Cover: correct answers from the knowledge base, refusal to invent, escalation
  triggers, tool selection, injection resistance, tone.
- A prompt or model change that lowers eval scores does not ship.
- Track in production: resolution rate, escalation rate, latency, cost per conversation,
  and human-corrected replies. A rising correction rate is a regression signal.

---

## Observability

Log per turn: model, prompt version, input/output token counts, latency, tool calls,
cost, escalation decision.

Never log raw customer message content in AI traces. Reference the message id instead.
