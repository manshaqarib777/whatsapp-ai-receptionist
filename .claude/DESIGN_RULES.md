# Design Rules

## The Bar

Every screen must look like **Framer, Linear, Stripe, Vercel, Raycast**.

**Not** Bootstrap. **Not** a generic admin template.

If a screen would not look out of place in one of those products, it passes. If it
looks like a CRUD dashboard with default shadcn spacing, it does not.

Required qualities:

- Large spacing
- Minimal UI
- Smooth animations
- Glass effects (where appropriate)
- Excellent typography
- Soft shadows
- Beautiful charts
- Premium cards
- Premium forms
- Modern tables
- Micro-interactions
- Empty states
- Skeleton loaders
- Transitions
- Command palette
- Dark mode + light mode

---

## Design System First

**Do NOT build pages before the design system.** (PRD, Milestone 3.)

Build, in this order: colours, typography, spacing, grid, buttons, inputs, dropdowns,
tables, cards, badges, dialogs, charts, navigation, sidebar, header, empty states,
loading states, error states, toast, modals, command palette, theme.

Only after the design system is **approved** may pages be built.

---

## Tokens

All tokens live in `src/ui/tokens.css` and are exposed through Tailwind config.
Never a raw hex, px, or ms value in a component. No arbitrary Tailwind values —
`p-[13px]` is a lint error.

---

## Spacing — 8-Point Grid

```
0   1(4)   2(8)   3(12)   4(16)   6(24)   8(32)   10(40)   12(48)   16(64)   20(80)
```

4px exists only for optical adjustment inside dense controls. Everything structural
lands on a multiple of 8.

**Be generous.** Premium UI reads as premium largely because of whitespace.

- Inside a component: `3`–`4`
- Between components: `6`–`8`
- Between sections: `12`–`20`
- Page padding: `8` mobile, `12`–`16` desktop

---

## Radius — Large and Rounded

```
sm   8px    inputs, badges, small controls
md   12px   buttons, menu items
lg   16px   cards, panels, inputs on forms
xl   24px   modals, sheets, hero surfaces
full 9999   avatars, pills
```

Default to **16px** for surfaces and **24px** for large containers. Large rounded
components are the house style — never square corners on a card.

---

## Typography

**Inter** for UI. **Geist** (or Geist Mono) for numeric and code.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Display | 40 | 600 | -0.02em |
| H1 | 32 | 600 | -0.02em |
| H2 | 24 | 600 | -0.01em |
| H3 | 20 | 600 | -0.01em |
| Body | 15 | 400 | 0 |
| Small | 13 | 400 | 0 |
| Caption | 12 | 500 | 0.01em |

- Negative tracking on headings — this is most of what separates premium from default.
- Line height 1.5 body, 1.2 headings.
- Max 75 characters per line. Never below 12px. Never centre a paragraph.
- Tabular numerals for any column of numbers.

---

## Colour

Semantic names only — never `blue-500` in a component.

```
--bg, --bg-subtle, --bg-elevated, --bg-glass
--fg, --fg-muted, --fg-subtle
--border, --border-strong
--primary, --primary-fg
--success, --warning, --danger, --info   (+ -subtle, -fg)
```

Domain tokens: `--msg-inbound`, `--msg-outbound`, `--msg-ai`, `--msg-agent`,
`--msg-failed`.

Rules:
- Light and dark are both first-class. Every token has both values. Neither is an
  afterthought.
- Contrast 4.5:1 text, 3:1 large text and UI boundaries. Verify, don't assume.
- **Never encode meaning in colour alone** — pair with icon, label, or shape. Delivery
  status, AI-vs-human authorship, and escalation state all need a non-colour signal.
- One accent per screen. Restraint reads as expensive.

---

## Elevation & Glass

```
shadow-sm   subtle lift — cards at rest
shadow-md   dropdowns, popovers
shadow-lg   modals, command palette
```

Soft, wide, low-opacity shadows. Never a hard dark drop shadow.

**Glass** (`backdrop-blur` + translucent `--bg-glass` + hairline border) for: sticky
headers, floating toolbars, the command palette, overlay sheets. Nowhere else — glass
on everything is a 2021 tell.

---

## Motion

Library: **Motion**. Tasteful animations only. **Never over-animate.**

```
instant 100ms   hover, focus, colour
fast    160ms   dropdowns, tooltips, toggles
base    220ms   dialogs, sheets, page transitions
slow    320ms   large surfaces, orchestrated sequences
easing  cubic-bezier(0.32, 0.72, 0, 1)
```

- Animate `transform` and `opacity` only. Never `width`, `height`, `top`, `left`.
- Nothing over 320ms. Nothing that blocks input.
- Stagger lists by 20–30ms per item, capped at ~8 items.
- Micro-interactions on every interactive element: hover, press, focus. Subtle —
  a 2% scale or a background shift, not a bounce.
- Honour `prefers-reduced-motion: reduce`: disable transitions, keep state instant.
- Skeletons for first load. Spinners only for actions over 400ms.

---

## Layout & Responsive

Breakpoints: `sm 640  md 768  lg 1024  xl 1280  2xl 1536`.

Verified at every milestone: **desktop, laptop, tablet, mobile, ultra-wide**.

- Mobile-first. The inbox must be fully usable at 375px.
- Content max width 1440px; reading columns max 720px. On ultra-wide, centre and cap —
  never stretch a table to 2560px.
- 4-column grid mobile, 8 tablet, 12 desktop.

---

## Density

The inbox is a tool staff live in all day. Prefer density there; prefer breathing room
in settings, onboarding, and marketing surfaces.

Row height: 56px comfortable, 44px compact. Both offered in the inbox.

---

## Iconography

**Lucide**, exclusively. 16px inline, 20px in buttons, 24px standalone. Stroke 1.5–2,
consistent everywhere. Icons never carry meaning alone — always a label or an
accessible name.
