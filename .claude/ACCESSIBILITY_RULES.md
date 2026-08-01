# Accessibility Rules

**Conformance target: WCAG 2.2 Level AA.**

`UI_RULES.md` → Accessibility lists the day-to-day component rules. This file states
the standard being conformed to, the criteria that are most often failed in a product
like this one, and how conformance is verified.

Accessibility is a **stop condition**, not a polish item. A component that fails a
criterion below is incomplete.

---

## 1. Why AA, and where it binds

AA is the level referenced by the EU Accessibility Act, the UK Equality Act's
reasonable-adjustment expectations, and most enterprise procurement checklists. A B2B
SaaS product that cannot answer an accessibility questionnaire loses deals — this is a
commercial requirement as much as an ethical one.

AAA is not the target. Some AAA criteria (7:1 contrast) conflict with the visual
standard in `DESIGN_RULES.md`, and WCAG itself does not recommend AAA as a
whole-site goal.

---

## 2. Criteria Most At Risk Here

The full spec is not reproduced. These are the ones this product will actually fail if
nobody is watching.

### Perceivable

| Criterion | Requirement | Where it bites |
|---|---|---|
| **1.1.1** Non-text Content | Every image, icon, and chart has a text alternative | Icon-only buttons; charts (`COMPONENT_DESIGN.md` → Charts) |
| **1.3.1** Info and Relationships | Structure conveyed visually is conveyed in markup | Tables using `<div>`; headings used for size |
| **1.4.1** Use of Colour | Colour is never the sole carrier of meaning | Delivery status, AI-vs-human authorship, chart series, deltas |
| **1.4.3** Contrast (Minimum) | 4.5:1 text, 3:1 large text (18.66px+ or 14px bold) | `--muted-foreground` on `--muted`; placeholder text |
| **1.4.10** Reflow | No horizontal scroll at 320px / 400% zoom | Tables — must become cards on mobile |
| **1.4.11** Non-text Contrast | 3:1 for UI boundaries, focus rings, chart elements | Input borders; disabled controls; gridlines |
| **1.4.12** Text Spacing | No loss of content when users override spacing | Fixed-height buttons and badges |
| **1.4.13** Content on Hover | Hoverable, dismissible, persistent | Tooltips, hover row actions |

### Operable

| Criterion | Requirement | Where it bites |
|---|---|---|
| **2.1.1** Keyboard | Everything operable by keyboard | Command palette, drag-to-reorder, charts |
| **2.1.2** No Keyboard Trap | Focus can always leave | Modals, the palette, embedded editors |
| **2.4.3** Focus Order | Order follows meaning | Modals; portalled dropdowns |
| **2.4.7** Focus Visible | Focus indicator always visible | Anywhere `outline: none` was written |
| **2.4.11** Focus Not Obscured *(2.2)* | Focused element not hidden by sticky UI | Sticky header covering a focused field |
| **2.5.7** Dragging Movements *(2.2)* | Drag has a single-pointer alternative | Kanban pipeline (M10), workflow builder (M13) |
| **2.5.8** Target Size (Minimum) *(2.2)* | 24×24px minimum | Icon buttons, table row actions, close buttons |

### Understandable

| Criterion | Requirement | Where it bites |
|---|---|---|
| **3.2.2** On Input | Changing a field does not auto-submit or navigate | Filter selects |
| **3.3.1** Error Identification | Errors identified in text | Forms |
| **3.3.2** Labels or Instructions | Visible labels | Placeholder-as-label — forbidden (`COMPONENT_DESIGN.md`) |
| **3.3.7** Redundant Entry *(2.2)* | Do not re-ask for information already given | Multi-step onboarding, checkout |
| **3.3.8** Accessible Authentication *(2.2)* | No cognitive-function test without an alternative | Login, 2FA (M2) — allow paste into OTP fields |

### Robust

| Criterion | Requirement | Where it bites |
|---|---|---|
| **4.1.2** Name, Role, Value | Custom controls expose all three | Anything built on `<div>` |
| **4.1.3** Status Messages | Status announced without focus change | Toasts, new messages, save confirmations |

---

## 3. Rules That Follow

### Focus

- `:focus-visible`, never `:focus` (`MOTION_RULES.md` → State Matrix).
- Focus ring: 2px `--ring`, `outline-offset: 2px`. Must reach 3:1 against **both** the
  component and the page background.
- Focus rings are never animated — a delay makes keyboard navigation feel broken.
- Sticky headers use `scroll-margin-top` so a focused field is never obscured (2.4.11).
- Modal opens → focus moves to the first control or the heading. Modal closes → focus
  returns to the trigger. No exceptions.
- Route change → focus moves to the `<h1>`, and the page title updates. Otherwise
  screen reader users have no idea navigation occurred.

### Target size

24×24px minimum (2.5.8); **44×44px is the standard for anything on a touch surface**.
An icon may be 16px while its hit area is 40px — use padding, not a bigger icon.

### Announcements

- `aria-live="polite"` for new messages, save confirmations, filter results.
- `aria-live="assertive"` **only** for errors that block progress. Assertive interrupts
  whatever is being read.
- The live region must exist in the DOM **before** the content changes — injecting a
  populated live region announces nothing.
- Never announce the same thing twice (a toast plus a live region).

### Motion

`prefers-reduced-motion` is honoured everywhere (`MOTION_RULES.md`). Reduced motion
means no translation, scale, or parallax — not merely slower.

### Zoom and reflow

Everything works at 400% zoom / 320px effective width, with no horizontal scrolling
(1.4.10). This is why tables become cards on mobile rather than scrolling sideways.

### Language

`<html lang>` is always set and updates with locale — including `dir` for Arabic
(`RTL_I18N_RULES.md`). Screen readers select a voice from it; the wrong `lang` makes
content unintelligible.

---

## 4. Verification

Automated tooling catches roughly 30–40% of issues. It is a floor, not a gate.

### Per component (Milestone 3 onward)

- [ ] `axe-core` via `vitest-axe` in the component test — zero violations.
- [ ] Keyboard only: reach it, operate it, leave it. Nothing unreachable, nothing trapped.
- [ ] Visible focus ring at every step.
- [ ] Contrast checked in **both** themes.
- [ ] Meaning survives with colour removed (greyscale the screenshot).
- [ ] Zoom to 400% — nothing clipped, no horizontal scroll.
- [ ] Reduced motion on — no movement.

### Per milestone

- [ ] Playwright + `@axe-core/playwright` on every route, both themes — zero
      violations, wired into CI as a blocking step.
- [ ] One full keyboard-only pass of the primary flow.
- [ ] One screen reader pass — VoiceOver (Safari) or NVDA (Firefox).
- [ ] Deuteranopia and protanopia simulation on any screen with charts or status colour.

### Definition of done

`MILESTONE_RULES.md` §8 requires "accessibility satisfied". That means the per-milestone
list above, evidenced in `MILESTONE_XX_COMPLETED.md` — not an assertion that it was
considered.

---

## 5. Standing Exceptions

None currently. Any exception must be recorded here with the criterion, the reason, the
user impact, and the milestone in which it is resolved. An undocumented failure is a
bug; a documented one is a decision.
