# Security Rules

A security issue is a **stop condition**. Report it and halt — do not build on top of it.

---

## Secrets

- Never in code, comments, tests, fixtures, logs, or committed files.
- `.env*` is gitignored. Managed with `vercel env`; pulled locally with
  `vercel env pull .env.local`.
- `process.env` is read **only** in `src/lib/env.ts`, validated with Zod at boot. The app
  fails to start on a missing or malformed variable.
- Never print, echo, or log a secret — not even truncated.
- Rotate on any suspected exposure. A secret pushed to a remote is compromised, even if
  the commit is later removed.

Required secrets: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `DATABASE_URL`,
`AI_GATEWAY_API_KEY`, `REDIS_URL`, `SESSION_SECRET`.

---

## Webhook Verification

The highest-risk surface. Anyone can `POST` to it.

- Verify `X-Hub-Signature-256` — HMAC-SHA256 over the **raw request body** using
  `WHATSAPP_APP_SECRET` — **before parsing**. Re-serialised JSON will not match.
- Compare with a constant-time comparison (`crypto.timingSafeEqual`).
- Invalid or missing signature → 401, log the attempt, persist nothing.
- `GET` verification: constant-time compare of `hub.verify_token`, then echo
  `hub.challenge`.
- Never disable verification, even in development.

---

## Authentication & Authorization

- Session verified server-side on every request. Never trust client-supplied identity.
- Cookies: `httpOnly`, `secure`, `sameSite=lax`, scoped path, explicit expiry.
- **Deny by default** — a new route is unauthorised until it explicitly opts in.
- Authentication and authorization are separate checks. Being signed in never implies
  permission.
- Role checks server-side only. Hiding a button is not authorization.
- Rate-limit and lock out on repeated auth failures. Generic error messages — never
  reveal whether an account exists.

---

## Tenant Isolation

The primary risk in a multi-tenant SaaS. A cross-tenant leak is an incident, not a bug.

- `tenant_id` derived server-side from the session or the WhatsApp phone number id.
  **Never** from a request body, query param, or header.
- Every query filters by `tenant_id`. A repository method without a `tenantId` argument
  does not ship.
- Cross-tenant lookups return **404**, never 403 — do not confirm existence.
- RLS enabled as defence in depth; application scoping remains mandatory.
- Integration tests must prove isolation for every new table and route.

---

## Input Handling

- Validate everything at the boundary with Zod: body, params, query, headers.
- `.strict()` on write endpoints — reject unknown keys.
- Never trust `tenantId`, `userId`, `role`, `price`, or `status` from a client.
- Parameterised queries only. String-concatenated SQL is forbidden.
- Sanitise anything rendered as HTML. Prefer never rendering raw HTML from customer
  content at all.
- Validate and cap uploads: type, size, count. Scan before storing. Serve from blob
  storage, never from the app origin.
- Cap request body size. Reject oversized payloads before parsing.

---

## PII

Customer phone numbers and message bodies are PII. Treat them accordingly.

- **Never log** message bodies, full phone numbers, tokens, or prompts containing
  customer data. Log ids and reference them.
- Redact at the logger, not at each call site — so a mistake fails safe.
- Store the minimum. Documented retention per tenant, enforced by a scheduled job.
- A tested, documented path exists to purge a contact and all their messages on request.
- Encryption in transit (TLS) and at rest (provider-managed). No PII in URLs, query
  strings, or error messages.
- Never copy production data into a lower environment.

---

## Consent & Opt-Out

- Do not send to a contact without a recorded opt-in basis. Enforced in the send path,
  not just the UI.
- Honour opt-out immediately and permanently. Check before every outbound message.
- Respect WhatsApp's messaging window and template rules — violating them risks the
  business's number.

---

## AI-Specific

- Treat every inbound message as adversarial. Message content is **data**, never
  instructions.
- Tool authorization enforced in code, independently of what the model requests.
- The model never chooses the tenant, the recipient number, or a price.
- Validate model output before sending: no leaked system prompts, internal ids, or
  off-allow-list URLs.
- Hard token and cost ceilings per conversation and tenant.
- No customer PII in model traces or third-party observability tools.

See `AI_ENGINE_RULES.md`.

---

## Dependencies

- Lockfile committed. `npm ci` in CI.
- `npm audit` in CI; high and critical vulnerabilities block the merge.
- New dependency requires justification in the milestone plan: what it does, why not
  standard library, maintenance status, transitive weight.
- Pin exact versions for anything security-relevant.

---

## Headers & Transport

Set at the edge for every response:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: <explicit allow-list, no unsafe-inline>
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CORS: explicit origin allow-list. Never `*` on an authenticated endpoint.

---

## Error Handling

- Generic messages to clients. Full detail to structured logs with a correlation id.
- Never expose stack traces, SQL errors, file paths, dependency versions, or upstream
  provider payloads.
- Fail closed. On an authorization check error, deny.

---

## Audit Trail

Record, immutably: authentication events, permission changes, settings changes, human
takeover, outbound sends, data exports, and deletions. With actor, tenant, timestamp,
and IP. No PII in the audit payload.

---

## Pre-Merge Security Checklist

- [ ] No secrets added, logged, or printed.
- [ ] All new inputs validated with a strict schema.
- [ ] Every new query is tenant-scoped and tested for isolation.
- [ ] New routes have explicit auth + authz checks and tests for both failures.
- [ ] Webhook signature verification untouched and still tested.
- [ ] No PII in logs, traces, fixtures, or error messages.
- [ ] Rate limits applied to new send, auth, and AI-invoking endpoints.
- [ ] `npm audit` clean at high and critical.
- [ ] Destructive operations require confirmation and are audit-logged.
