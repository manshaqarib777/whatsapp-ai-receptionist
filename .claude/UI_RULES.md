# UI Rules

The visual bar — Framer / Linear / Stripe / Vercel / Raycast — is set in
`DESIGN_RULES.md`. This file covers component construction.

**Design system before pages.** Milestone 3 builds components only, no pages.

---

## Component Rule

Maximum **300 lines**. If bigger: **split**.

Every component must have:

- Clear responsibility
- Typed props
- Loading state
- Error state
- Empty state
- Accessibility

A component missing any of these is incomplete, not "to be polished later".

---

## Layering

```
Page
 ↓
Feature Component
 ↓
Hook
 ↓
Service
 ↓
API
```

- **Page** — routing, layout, data orchestration. No business logic.
- **Feature Component** — domain-aware rendering. Reads from hooks. No fetch calls.
- **Hook** — state, caching, mutations. Calls services.
- **Service** — request shaping, error mapping. Calls the API.

A component never calls `fetch` and never touches the database.

---

## The Four States

Every data-bound component handles all four, explicitly:

| State | Requirement |
|---|---|
| **Loading** | Skeleton matching the real layout. No layout shift on resolve. |
| **Error** | What failed, in plain language. A retry action. Never a raw stack. |
| **Empty** | Explain why it's empty and the next action. Never a bare "No data". |
| **Success** | The content. |

Also handle **partial** where relevant: some messages loaded, older still fetching.

---

## Props

```tsx
type ConversationThreadProps = {
  conversationId: string;
  onEscalate: (conversationId: string) => void;
  isReadOnly?: boolean;
};
```

- Explicit named type, exported when reused.
- No `any`, no `object`, no spreading unknown props into DOM elements.
- Booleans default to `false`. Name them positively.
- Callbacks named `onX`; handlers named `handleX`.
- Maximum 8 props. Beyond that, the component is doing too much — split or compose.

---

## Accessibility — Non-Negotiable

- Semantic HTML first. `<button>` for actions, `<a>` for navigation. Never a clickable
  `<div>`.
- Every interactive element is keyboard reachable and operable. Visible focus ring
  always — never `outline: none` without a replacement.
- Every input has a associated `<label>`. Placeholders are not labels.
- Icon-only buttons have `aria-label`.
- Modals: focus trapped, `Escape` closes, focus returns to the trigger.
- Live regions (`aria-live="polite"`) for incoming messages and status changes so
  screen reader users are told a new message arrived.
- Images and avatars have `alt`; decorative ones have `alt=""`.
- Contrast per `DESIGN_RULES.md`. Never colour alone for meaning.
- Test with keyboard only, then with a screen reader, before marking done.

---

## Forms

- Zod schema shared with the API — one source of truth for validation.
- Validate on blur, re-validate on change once touched. Never validate on first keystroke.
- Errors sit beside the field, describing the fix, wired with `aria-describedby`.
- Disable submit while pending and show progress. Guard against double submit.
- Never clear user input on a failed submit.
- Destructive actions require explicit confirmation naming the target.

---

## Realtime & Optimistic UI

The inbox is realtime. Rules:

- Optimistic send: render the outbound message immediately as `pending`, reconcile on
  the delivery receipt, mark `failed` with a retry action if it never arrives.
- Never lose a user's typed draft — persist per conversation.
- New inbound messages must not scroll-jump the reader; show a "new messages" affordance
  instead when scrolled up.
- Show clearly whether a reply was written by the **AI** or a **human agent**. This is a
  trust requirement, not a nicety.

---

## Command Palette

Required by the PRD. `⌘K` / `Ctrl+K` from anywhere.

- Actions, navigation, and search in one surface. Recent and suggested items when empty.
- Fully keyboard-driven: arrows, `Enter`, `Esc`, no mouse needed. Type-ahead filtering.
- Scoped context where useful — inside a conversation it offers assign, label, escalate.
- Registered declaratively per feature so a new feature adds its own commands without
  editing a central switch.

---

## Responsive Verification

Every screen verified at: **desktop, laptop, tablet, mobile, ultra-wide** before a
milestone closes. Ultra-wide means content is centred and capped, not stretched.

---

## Performance

- Server Components by default. `'use client'` only when the component needs
  interactivity or browser APIs.
- Virtualise any list that can exceed 100 rows (conversation list, message history).
- `next/image` for all images, with explicit dimensions.
- Lazy-load modals, drawers, and charts.
- No new render-blocking fonts or scripts. Measure the bundle delta on every PR.
- Memoise only after measuring — not by reflex.

---

## Copy

- Sentence case. No exclamation marks. No "Oops".
- Say what happened and what to do: "Message not delivered. Retry."
- Buttons are verbs: "Send", "Escalate", "Assign to me".
- Never expose internal identifiers, model names, or stack traces to end users.
