# Design Rules

The design system spans several files. This one holds the principles and the scales.

| File | Covers |
|---|---|
| **`DESIGN_RULES.md`** (this file) | The bar, spacing, radius, type, colour, elevation, motion scale, layout, iconography |
| `DESIGN_TOKENS.md` | Concrete token values, colour ramps, dark mode, shadows, z-index |
| `COMPONENT_DESIGN.md` | Visual hierarchy, cards, forms, tables, sidebar, dashboard, charts |
| `MOTION_RULES.md` | Interaction states, Framer Motion patterns, micro-interactions, skeletons |
| `ACCESSIBILITY_RULES.md` | WCAG 2.2 AA conformance and verification |
| `RTL_I18N_RULES.md` | Arabic / RTL and internationalisation |
| `LANDING_PAGE_RULES.md` | Marketing surfaces |
| `UI_RULES.md` | Component construction — props, states, layering |

---

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

## Layout Composition

What makes a layout read as Framer/Linear rather than as an admin template.

- **Content is centred and capped, never full-bleed.** Backgrounds may span the
  viewport; content sits in a 1152–1440px column. Full-width text at 2560px is the
  clearest tell of an unconsidered layout.
- **Asymmetry over symmetry.** A 2/3 + 1/3 split reads as designed; two equal halves
  read as a default. Reserve equal columns for genuinely peer content.
- **Compose in horizontal bands.** A page is a vertical stack of full-width bands, each
  with its own background and internal grid. This is what allows generous spacing
  without the page feeling empty.
- **One focal point per viewport.** As the user scrolls, exactly one thing should be
  the most important.
- **Group by proximity before reaching for a border.** Space, then background change,
  then a hairline — in that order. Boxes inside boxes inside boxes is the admin-template
  signature.
- **Anchor the corners.** Sticky header, sidebar, and a bottom-pinned account menu give
  the app a frame; free-floating content in an unstructured page feels unfinished.
- **Consistent optical margins.** The gap from content to viewport edge is the same on
  every page. Inconsistent page padding is noticed even when it cannot be named.

---

## Tokens

Tokens live in **`src/app/globals.css`** — Tailwind v4 is CSS-first, so there is no
`tailwind.config.js`. Values and the three-tier architecture are in `DESIGN_TOKENS.md`.

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

- Content max width 1440px; reading columns max 720px. On ultra-wide, centre and cap —
  never stretch a table to 2560px.
- 4-column grid mobile, 8 tablet, 12 desktop.

### Mobile-first — the strategy, not the slogan

**Write the mobile layout first, then add complexity upward.** Base classes are mobile;
`sm:`, `md:`, `lg:` add to them. A codebase full of `lg:` overrides undoing desktop
defaults is desktop-first wearing mobile-first clothing.

```tsx
// Wrong — desktop first, walked back
<div className="flex gap-8 p-12 max-lg:flex-col max-lg:p-6">

// Right — mobile base, enhanced upward
<div className="flex flex-col gap-6 p-6 lg:flex-row lg:gap-8 lg:p-12">
```

- **Design the smallest viewport first.** It forces prioritisation: what survives at
  375px is what actually matters. Cutting from desktop keeps the wrong things.
- **Breakpoints follow content, not devices.** Add one where the layout breaks, not
  because a phone has that width.
- **Touch targets 44×44px** on any touch-capable viewport
  (`ACCESSIBILITY_RULES.md` 2.5.8) — larger than the 24px WCAG floor.
- **Nothing is hover-only.** Touch has no hover. Every hover affordance has a tap and a
  focus equivalent.
- **Reachability**: primary actions sit within thumb reach — bottom sheets rather than
  centred modals, bottom-anchored primary buttons on long forms.
- **Tables become cards** below `md`. Horizontal scrolling on a phone is a failure, and
  a reflow violation (`ACCESSIBILITY_RULES.md` 1.4.10).
- **Sidebar becomes a drawer or bottom tabs** below `lg`.
- **Test on a real device**, not just a resized window — hover, scroll momentum,
  keyboard overlay, and safe-area insets all differ.
- **Respect safe areas** on notched devices: `env(safe-area-inset-*)` for anything
  pinned to an edge.

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
