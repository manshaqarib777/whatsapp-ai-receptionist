# Motion Rules

Implementation-level motion. The timing scale, easing, and "never over-animate"
principle are in `DESIGN_RULES.md` → Motion; this file covers how to build it.

Library: **Motion** (`motion/react`, formerly Framer Motion).

---

## 1. Interaction State Matrix

Every interactive element implements every applicable state. A component missing one is
incomplete, not "to be polished later" (`UI_RULES.md`).

| State | Visual | Duration |
|---|---|---|
| **Rest** | Base tokens | — |
| **Hover** | Background one step (`--accent`), or `--shadow-sm`→`md` | 100ms |
| **Focus-visible** | 2px `--ring`, `outline-offset: 2px` | instant |
| **Active / pressed** | `scale(0.98)`, background one step darker | 80ms |
| **Selected** | `--accent` bg + `--primary` marker + 500 weight | 160ms |
| **Disabled** | 50% opacity, `cursor: not-allowed`, no hover/active | instant |
| **Loading** | Spinner replaces label, width held, pointer-events none | 160ms |
| **Error** | `--destructive` border + ring, 3px shake | 300ms |

### Non-negotiables

- **`:focus-visible`, not `:focus`.** `:focus` puts a ring on mouse clicks, which
  designers then remove entirely — and keyboard users lose everything. Use
  `:focus-visible` and keep the ring loud.
- **Never `outline: none` without an equivalent replacement.** This is the single most
  common accessibility regression in a design system.
- **Hover is not a substitute for focus.** Every hover affordance has a focus
  equivalent. Touch devices have neither — nothing may be hover-only
  (`COMPONENT_DESIGN.md` → Tables).
- **Pressed state is mandatory on touch.** Without it, a tap feels like nothing
  happened and users double-submit.
- **Loading buttons keep their width.** A button that shrinks to fit "…" causes layout
  shift and mis-clicks. Reserve the label width.
- **Disabled elements explain themselves.** A disabled button with no tooltip is a dead
  end. Prefer enabled-with-validation-message over disabled.

---

## 2. Motion Primitives

Standard variants. Do not invent per-component animations.

```tsx
// src/lib/motion.ts — single source of truth for motion values
export const EASE = [0.32, 0.72, 0, 1] as const;

export const DURATION = {
  instant: 0.1,
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: EASE },
};

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: DURATION.base, ease: EASE },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: DURATION.base, ease: EASE },
};

// Stagger — cap the count, or long lists cascade for seconds.
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.025, delayChildren: 0.02 } },
};
```

| Primitive | Applies to |
|---|---|
| `fadeIn` | Tooltips, backdrops, tab panels |
| `fadeUp` | Dropdowns, popovers, toasts, cards entering |
| `scaleIn` | Modals, command palette |
| `staggerContainer` | Lists on first render only — never on refetch |

---

## 3. Framer Motion API Rules

### Use variants, not inline props

```tsx
// Wrong — values scattered, impossible to keep consistent
<motion.div animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} />

// Right — named, shared, reviewable
<motion.div {...fadeUp} />
```

### `AnimatePresence` for anything that unmounts

Exit animations require it. A modal that fades in and vanishes instantly looks broken.

```tsx
<AnimatePresence mode="wait">
  {isOpen && <motion.div key="dialog" {...scaleIn} />}
</AnimatePresence>
```

- **`key` is required** and must be stable — without it, exit never fires.
- **`mode="wait"`** when swapping content in the same slot; the default overlaps them.
- **`mode="popLayout"`** for lists where items leave and neighbours should close the gap.

### `layout` — powerful and dangerous

`layout` animates position and size changes automatically. It is the single best tool
for reordering lists, and the single easiest way to make a UI feel sluggish.

- Use for: reordering, expand/collapse, filter transitions.
- **Never on a virtualised list** — it fights the virtualiser and drops frames.
- **Never on a list over ~30 visible items.**
- Always pair with `layoutId` for shared-element transitions, never two separate
  elements that happen to look alike.
- Wrap sibling groups in `<LayoutGroup>` so they measure together.

### `useReducedMotion` is mandatory

```tsx
const shouldReduce = useReducedMotion();

<motion.div
  {...(shouldReduce ? fadeIn : fadeUp)}
  transition={{ duration: shouldReduce ? 0 : DURATION.base, ease: EASE }}
/>
```

Reduced motion means **no movement**, not "slightly less movement". Opacity is
acceptable; translation, scale, and parallax are not. Vestibular disorders are a real
accessibility requirement, not a preference (`ACCESSIBILITY_RULES.md`).

Also honour it in CSS for non-Motion transitions:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Performance

- **`transform` and `opacity` only.** Animating `width`, `height`, `top`, or `left`
  triggers layout on every frame. Use `scale` and `translate`.
- **Do not leave `will-change` on.** It permanently allocates a compositor layer.
  Motion manages this; adding it manually usually hurts.
- **Spring or duration, not both.** Springs (`type: 'spring'`) suit direct
  manipulation — drags, sheets following a finger. Durations suit everything else.
  Default to duration.
- **Never animate more than ~20 elements simultaneously.** Stagger or virtualise.
- **Import from `motion/react`** and lazy-load heavy animated surfaces
  (`UI_RULES.md` → Performance).

---

## 4. Micro-Interaction Catalogue

Small, fast, and everywhere. Their absence is what makes a UI feel dead.

| Interaction | Behaviour |
|---|---|
| Button press | `scale(0.98)`, 80ms |
| Card hover | `--shadow-sm` → `md`, border strengthens, 160ms. No lift on static cards. |
| Icon button hover | Background fades in, icon `scale(1.05)`, 100ms |
| Checkbox / radio | Tick draws over 160ms; box scales 0.9→1 |
| Toggle | Thumb slides 160ms; track colour crossfades |
| Tab switch | Active indicator slides via `layoutId` — the signature Linear/Vercel move |
| Accordion | Height + opacity, 220ms |
| Copy to clipboard | Icon morphs to a tick for 1.5s, then back |
| Send message | Optimistic bubble scales 0.96→1 and fades in |
| Delivery status | Tick crossfades sent → delivered → read |
| Toast enter | Slide 8px + fade, 220ms; exit fade + 4px, 160ms |
| Number change | Count up over 400ms for KPIs — **only** on first load, never on refetch |
| Row hover | Background 100ms; actions fade in 100ms |
| Focus ring | Instant. Never animated — delay makes keyboard nav feel broken. |
| Error | 3px horizontal shake, 300ms, once |
| Drag | `scale(1.02)` + `--shadow-lg`; drop settles with a spring |

### Restraint rules

- **Never animate on data refetch.** Re-running entrance animations every poll is
  nauseating. Animate on mount only.
- **Never animate the same element twice in one interaction.**
- **Nothing bounces** except direct-manipulation drops. Overshoot on a dropdown is a
  toy, not a tool.
- **No decorative animation.** No floating blobs, no pulsing gradients, no
  scroll-jacking. Every animation explains a change of state.
- **If it delays the user, it is wrong.** Motion should feel like the interface keeping
  up, never like waiting for it.

---

## 5. Skeleton Loaders

Skeletons for first load; spinners only for actions over 400ms (`DESIGN_RULES.md`).

### Construction

- **A skeleton mirrors the real layout** — same dimensions, same radii, same spacing.
  A generic grey box that reflows on resolve is worse than nothing.
- **Zero cumulative layout shift.** If the skeleton is the wrong size, it fails its
  only job. Verify by toggling between states.
- **Match the shape**: text lines use text height with `--radius-sm`; avatars are
  circles; cards keep `--radius-lg`.
- **Vary line widths** — a paragraph skeleton with a shorter final line reads as text.
  Uniform bars read as a loading bar.
- **Show a realistic count**, typically 3–5 rows. Never fill the viewport.

### Animation

- Shimmer: a subtle gradient sweeping over 1.5s, or a 2s opacity pulse between
  `--muted` and a slightly lighter value. Nothing faster — fast shimmer is agitating.
- **All skeletons on a screen animate in sync.** Independent phases look like static.
- Honour `prefers-reduced-motion`: static `--muted` blocks, no shimmer.

### When not to skeleton

- **Under ~300ms**: show nothing. A flash of skeleton is worse than a brief blank.
- **Refetch of already-visible data**: keep the old data, dim slightly or show a thin
  top progress bar. Never replace content with a skeleton — it destroys the user's
  place.
- **Pagination and infinite scroll**: skeleton only the incoming rows.
- **Unknown shape**: if you cannot predict the layout, use a spinner honestly.

### Accessibility

Skeleton containers carry `aria-busy="true"` and an `aria-label` describing what is
loading. Individual skeleton shapes are `aria-hidden` — a screen reader must not
announce twelve empty boxes.

---

## 6. Page and Route Transitions

- **Keep them near-invisible.** 160ms fade on the content region only. The sidebar and
  header never re-animate — they persist.
- **Never animate a full page slide.** It delays every navigation and makes a SaaS app
  feel like a slideshow.
- **Preserve scroll position** on back-navigation.
- **Optimistic navigation**: highlight the destination in the sidebar immediately, then
  stream content. Never wait for data to change the active state.
