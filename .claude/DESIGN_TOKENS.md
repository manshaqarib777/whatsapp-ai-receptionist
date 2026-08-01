# Design Tokens

The concrete values behind `DESIGN_RULES.md`. That file states the *rules*; this file
states the *numbers* and where they live.

**Source of truth**: `src/app/globals.css` (Tailwind v4 is CSS-first — there is no
`tailwind.config.js`). Never a raw hex, px, or ms value in a component.

---

## 1. Token Architecture — Three Tiers

Never let a component reach past its tier.

```
Tier 1  Primitive   --grey-100, --blue-600, --space-4
                    Raw values. Referenced ONLY by tier 2. Never in a component.
        ↓
Tier 2  Semantic    --background, --foreground, --primary, --success
                    Meaning, not appearance. This is what components use.
        ↓
Tier 3  Component   --sidebar, --sidebar-accent, --chart-1
                    Scoped overrides where a surface needs its own ramp.
```

A component that uses `--blue-600` instead of `--primary` breaks theming and dark mode
simultaneously. Reviewers should reject it.

---

## 2. Colour — Implemented Values

Colour space is **OKLCH**, not hex. OKLCH is perceptually uniform: `oklch(0.6 0.2 250)`
and `oklch(0.6 0.2 140)` genuinely look equally bright, so a hue change does not
silently break contrast. This matters when generating ramps and dark variants.

### Base semantic tokens (already implemented)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page canvas |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Primary text |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card surface |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Floating surface |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Primary action |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary action |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Muted surface |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Hover surface |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Danger |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Hairlines |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Field borders |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus ring |

Note the dark-mode `--border` uses **alpha over the surface** (`oklch(1 0 0 / 10%)`)
rather than a solid grey. Solid borders in dark mode read as heavy lines; translucent
ones read as edges. Keep this pattern for any border token added later.

### Status tokens — REQUIRED, not yet implemented

`DESIGN_RULES.md` references `--success`, `--warning`, `--info`. They do not exist in
`globals.css` yet. **Milestone 3 must add them**, each with `-foreground` and `-subtle`
variants:

| Token | Light | Dark |
|---|---|---|
| `--success` | `oklch(0.55 0.15 155)` | `oklch(0.70 0.16 155)` |
| `--success-subtle` | `oklch(0.95 0.04 155)` | `oklch(0.27 0.06 155)` |
| `--warning` | `oklch(0.70 0.16 75)` | `oklch(0.80 0.15 75)` |
| `--warning-subtle` | `oklch(0.96 0.05 75)` | `oklch(0.28 0.06 75)` |
| `--info` | `oklch(0.58 0.16 250)` | `oklch(0.72 0.15 250)` |
| `--info-subtle` | `oklch(0.95 0.04 250)` | `oklch(0.27 0.07 250)` |

Pattern: **solid** for icons, text, and borders; **`-subtle`** for filled badge and
banner backgrounds. Never use the solid value as a large background fill.

### Domain tokens — Milestone 6

`--msg-inbound`, `--msg-outbound`, `--msg-ai`, `--msg-agent`, `--msg-failed`. Added
when the inbox is built, not before.

### Ramp generation

When a brand colour is chosen, generate its ramp by holding hue constant and stepping
lightness. Do not hand-pick steps.

```
50  L 0.97   |  400 L 0.68  |  800 L 0.32
100 L 0.94   |  500 L 0.58  |  900 L 0.24
200 L 0.88   |  600 L 0.50  |  950 L 0.18
300 L 0.79   |  700 L 0.41  |
```

Chroma peaks around 500–600 and tapers at both ends; a flat chroma across the ramp
makes light steps look muddy and dark steps look neon.

---

## 3. Dark Mode

**Strategy**: class-based (`.dark` on `<html>`), not `prefers-color-scheme` alone —
users must be able to override the system.

```css
@custom-variant dark (&:is(.dark *));
```

### Rules

- **Every semantic token has both values.** A component never contains `dark:` colour
  utilities. If you are writing `dark:bg-slate-800`, a token is missing.
- **Dark is not inverted light.** `--card` in dark is *lighter* than `--background`
  (`0.205` vs `0.145`) — elevation is expressed by getting lighter, because shadows are
  nearly invisible on dark surfaces. Never simply flip lightness values.
- **Never pure black.** `--background` is `oklch(0.145 0 0)`, not `0`. Pure black
  against white text causes halation and reads as cheap.
- **Desaturate in dark.** Saturated colours vibrate on dark backgrounds — note
  `--destructive` drops from chroma `0.245` to `0.191`.
- **Shadows barely work in dark.** Use border and surface lightness for elevation
  instead; keep shadows only for genuinely floating layers.
- **Re-verify contrast in both themes.** A pair that passes in light frequently fails
  in dark. Both are audited, not just the default.

### No flash of wrong theme

The theme class must be applied before first paint by a blocking inline script that
reads `localStorage`, falling back to `prefers-color-scheme`. `<html>` carries
`suppressHydrationWarning`. A theme flash on every load is the single most visible
"unfinished" signal in a SaaS product.

---

## 4. Elevation — Shadow Values

`DESIGN_RULES.md` names three levels. These are the values.

```css
--shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.04);
--shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.06),
             0 1px 2px -1px oklch(0 0 0 / 0.04);
--shadow-md: 0 4px 12px -2px oklch(0 0 0 / 0.08),
             0 2px 6px -2px oklch(0 0 0 / 0.05);
--shadow-lg: 0 12px 32px -8px oklch(0 0 0 / 0.12),
             0 4px 12px -4px oklch(0 0 0 / 0.06);
--shadow-xl: 0 24px 64px -12px oklch(0 0 0 / 0.16),
             0 8px 24px -8px oklch(0 0 0 / 0.08);
```

Two layers per shadow — a tight one for contact and a wide one for ambient spread. A
single-layer shadow is what makes a UI look like Bootstrap.

Opacity stays at or below 0.16. Blur is always several times the Y offset. In dark
mode, reduce all opacities by roughly half and lean on surface lightness instead.

| Level | Applies to |
|---|---|
| `xs` | Inputs at rest, table row hover |
| `sm` | Cards at rest |
| `md` | Dropdowns, popovers, tooltips, hovered cards |
| `lg` | Modals, sheets, command palette |
| `xl` | Rare — full-screen overlays, marketing hero cards |

---

## 5. Z-Index Scale

Ad-hoc `z-50` is how stacking bugs start. Every layer is named.

```css
--z-base:        0;
--z-raised:      10;   /* hovered card, sticky table header */
--z-sticky:      20;   /* sticky page header, sidebar */
--z-dropdown:    30;   /* menus, comboboxes, popovers */
--z-overlay:     40;   /* modal backdrop, drawer scrim */
--z-modal:       50;   /* dialog, sheet, drawer */
--z-palette:     60;   /* command palette — sits above modals */
--z-toast:       70;   /* notifications — always visible */
--z-tooltip:     80;   /* never occluded */
```

Never invent a value between two levels. If something needs to sit between, the layer
model is wrong — fix the model.

---

## 6. Radius — Reconciling Doc and Code

**Known inconsistency.** `DESIGN_RULES.md` specifies `lg = 16px`, but `globals.css` sets
`--radius: 0.625rem` (10px), from which shadcn derives the rest.

**Resolution — Milestone 3 sets `--radius: 1rem` (16px)** to match the documented
house style. The derived scale then becomes:

| Token | Formula | Value | Use |
|---|---|---|---|
| `--radius-sm` | `× 0.6` | 9.6px | Badges, small controls |
| `--radius-md` | `× 0.8` | 12.8px | Buttons, menu items |
| `--radius-lg` | `× 1.0` | **16px** | Cards, inputs, panels |
| `--radius-xl` | `× 1.4` | 22.4px | Modals, sheets |
| `--radius-2xl` | `× 1.8` | 28.8px | Hero surfaces |

**Nested radius rule**: an inner element's radius = outer radius − padding between
them. A 16px card with 8px padding takes a 8px inner radius. Equal radii on nested
surfaces look wrong, and most people cannot say why.

---

## 7. Spacing, Typography, Motion

Defined in `DESIGN_RULES.md` — not repeated here. Exposed as:

```css
--space-1 … --space-20        8-point grid
--text-display … --text-caption
--duration-instant|fast|base|slow
--ease-standard: cubic-bezier(0.32, 0.72, 0, 1);
```

---

## 8. Chart Tokens

`--chart-1` … `--chart-5` currently hold a **greyscale** placeholder ramp
(`oklch(0.87 0 0)` → `oklch(0.269 0 0)`). That satisfies nothing the PRD asks for —
"beautiful charts" cannot be greyscale.

Milestone 3 replaces them with a categorical palette meeting the rules in
`COMPONENT_DESIGN.md` → Charts: distinguishable in both themes, distinguishable under
deuteranopia and protanopia, and never the sole carrier of meaning.

Extend, do not replace, when more series are needed:

```css
--chart-1 … --chart-8          categorical
--chart-positive               gains, growth, resolved
--chart-negative               losses, churn, failures
--chart-grid                   axis and gridlines
--chart-tooltip-bg             tooltip surface
```

---

## 9. Adding a Token — Checklist

- [ ] Is there an existing token for this? Reuse it.
- [ ] Is the name semantic (`--danger`) rather than descriptive (`--red`)?
- [ ] Does it have a light **and** a dark value?
- [ ] Does it pass WCAG AA contrast against every surface it can land on, in **both**
      themes? (`ACCESSIBILITY_RULES.md`)
- [ ] Is it registered in `@theme inline` so Tailwind generates utilities?
- [ ] Is it documented here?
