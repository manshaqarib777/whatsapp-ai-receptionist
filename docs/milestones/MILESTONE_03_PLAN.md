# Milestone 3 — Design System

Status: Complete — structurally re-certified 2026-08-23
Created: 2026-08-01
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 3`

---

## Objective

A complete, token-driven component library that every later milestone builds screens
from — so no milestone ever invents its own button, table, or empty state.

After this milestone the following are true and are not true now:

- Every value in the UI comes from a token. No raw hex, px, or ms in a component.
- `--success`, `--warning`, `--info`, the shadow scale, and the z-index scale exist
  (they are referenced by the rule files today but absent from the stylesheet).
- Light and dark are both first-class, with **no flash** of the wrong theme on load.
- `prefers-reduced-motion` is honoured globally.
- Every component works in **RTL** and is checked by `axe` in its own test.
- A dev-only gallery renders every component in every state, so "test visually" is
  something a person can actually do.
- The auth screens from Milestone 2 are restyled against the system.

**Out of scope**: product pages. The dashboard is Milestone 5, the inbox Milestone 6.

---

## Requirements

Copied verbatim from `/docs/PRODUCT_REQUIREMENTS.md`:

```
# MILESTONE 3

Design System

Build every reusable component.

No pages.

Only components.

Buttons

Inputs

Checkboxes

Radio

Avatar

Dialogs

Toast

Charts

Cards

Sidebar

Header

Forms

Tables

Calendar

Command Menu

Tabs

Accordion

Dropdown

Pagination

Progress

Timeline

Tag

Breadcrumb

Rich Text

Markdown

Uploader

Date Picker

Time Picker

Charts

Metrics

Animations

Dark Mode

STOP

Test visually.

Approve.
```

---

## Interpretation and Open Questions

### "No pages. Only components." vs "Test visually."

These conflict: a component cannot be reviewed visually without something rendering it.

**Resolution**: build a **dev-only gallery** at `/design`, excluded from the production
build. It is a development tool that ships with the design system, not a product page.
No product route is created. Flagged here rather than silently resolved.

### Two items are features, not primitives

**Rich Text** and **Uploader** are the only entries on the list that need backend
support (sanitisation policy, storage, virus scanning, size limits). Building them
"fully" here would pull Milestone 24 storage work forward.

**Resolution**: build the *presentational* layer only — a rich-text editor with a
strict, tested sanitisation policy, and an uploader with drag/drop, preview, progress,
and validation, wired to a stub upload port. The real storage adapter lands with the
milestone that needs it. Recorded as a known limitation rather than claimed complete.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Base layer | shadcn/ui (Radix) where a primitive exists | Already adopted; accessible behaviour is the hard part and Radix has solved it |
| Charts | Recharts via shadcn `chart` | Composable, themeable from CSS variables, and the shadcn wrapper already handles tooltips/legends |
| Motion | `motion/react` | Per `DESIGN_RULES.md`; already the documented library |
| Calendar / date | `react-day-picker` (shadcn `calendar`) | Locale- and RTL-aware, keyboard accessible |
| Command menu | `cmdk` (shadcn `command`) | The `⌘K` requirement in `UI_RULES.md` |
| Rich text | Tiptap | Headless, schema-controlled — sanitisation is enforceable rather than hoped for |
| Markdown | `react-markdown` + `remark-gfm` | No `dangerouslySetInnerHTML`; sanitises by construction |
| Theme | `next-themes` | Solves the flash-of-wrong-theme problem properly |

**Layering**: primitives live in `src/components/ui/` and know nothing about the
domain. Composed, still-domain-agnostic pieces (metric card, empty state, page header,
data table) live in `src/components/`. Domain components stay in their feature
directory, as now (`ARCHITECTURE_RULES.md`).

**Token flow** stays three-tier per `DESIGN_TOKENS.md`: primitive → semantic →
component. Components consume semantic tokens only.

---

## Dependencies

| Package | For |
|---|---|
| `next-themes` | Theme switching without a flash |
| `motion` | Animation primitives |
| `recharts` | Charts |
| `cmdk` | Command menu |
| `react-day-picker`, `date-fns` | Calendar, date picker |
| `@tiptap/react`, `@tiptap/starter-kit` | Rich text |
| `react-markdown`, `remark-gfm` | Markdown |
| `@tanstack/react-table` | Table sorting/paging/selection |
| `vitest-axe` (dev) | Per-component accessibility assertions |

Plus shadcn primitives not yet installed: checkbox, radio-group, dialog, sheet, tabs,
accordion, table, calendar, command, popover, progress, tooltip, select, textarea,
switch, breadcrumb, pagination, scroll-area, sidebar, chart, collapsible, toggle.

---

## Database Impact

**None.** No schema change, no migration. This milestone is presentation only.

---

## API Impact

**None.** No route added, changed, or removed.

---

## UI Impact

The whole milestone. Grouped by the PRD's list:

| Group | Components |
|---|---|
| **Tokens** | colour (incl. status + chart), spacing, radius, type, shadow, z-index, motion |
| **Form** | button, input, textarea, checkbox, radio, switch, select, label, form field, date picker, time picker, uploader, rich text |
| **Display** | card, avatar, tag/badge, table, timeline, metric, markdown, progress, skeleton |
| **Overlay** | dialog, sheet, dropdown, popover, tooltip, toast, command menu |
| **Navigation** | sidebar, header, tabs, breadcrumb, pagination, accordion |
| **Feedback** | empty state, error state, loading state |
| **Charts** | line, bar, area, sparkline, with accessible table fallback |

**Restyling**: Milestone 2's auth screens are brought onto the system. Their structure
and behaviour do not change — only tokens and composition — so the existing auth tests
must continue to pass unmodified. That is the check that the restyle is cosmetic.

---

## AI Impact

**None.** The AI Engine is Milestone 8.

---

## Security Considerations

Mostly low, with two genuine exceptions:

| Area | Measure |
|---|---|
| **Rich text** | The editor's schema is an allow-list. Output is sanitised on write **and** on render — never `dangerouslySetInnerHTML` with unfiltered input. Tested with XSS payloads. |
| **Markdown** | `react-markdown` with raw HTML disabled. `javascript:` and `data:` URLs stripped. Tested with payloads. |
| **Uploader** | Client-side type and size validation is UX only; the server re-validates when storage lands. Documented so nobody mistakes it for a control. |
| Theme script | Inline, so it must be nonce-compatible when CSP tightens in Milestone 23. Noted there. |
| External links | `rel="noopener noreferrer"` on any `target="_blank"`. |

No new secrets, no PII handling, no auth surface.

---

## Testing Strategy

**Component** (the bulk): every component gets a test covering its variants, all four
states where applicable, keyboard operation, and `axe` with zero violations.

**Unit**: `cn` merge behaviour; chart data formatting; sanitisation of rich text and
markdown against XSS payloads; date/time formatting across locales.

**Integration**: theme persistence and the no-flash path; command menu registration.

**E2E**: the gallery renders in light and dark, in LTR and RTL, at five viewports, with
zero axe violations; keyboard traversal of the command menu, dialog focus trap, and
sidebar navigation.

**Regression**: Milestone 2's auth tests must pass **unmodified**. If the restyle
breaks them, the restyle changed behaviour, which it must not.

**Accessibility**: `vitest-axe` per component, `@axe-core/playwright` per gallery
route, both themes, both directions. Wired as a blocking CI step.

---

## Token Debt to Clear First

Recorded in `.claude/MILESTONE_RULES.md` §7 and carried from Milestones 1–2. All of it
lands before any component is authored, because components consume it:

- [ ] `--radius: 1rem` (currently `0.625rem`; documented as 16px)
- [ ] `--success`, `--warning`, `--info` with `-foreground` and `-subtle` variants
- [ ] Replace the greyscale `--chart-1…5` placeholders with a real categorical palette
- [ ] `--shadow-xs…xl` two-layer scale
- [ ] `--z-*` named scale
- [ ] No-flash theme script
- [ ] `prefers-reduced-motion` global reset
- [ ] ESLint rule forbidding physical direction utilities (`pl-`, `mr-`, `left-`)
- [ ] `vitest-axe` and an RTL Playwright project

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Scale.** 31 categories is the largest milestone so far and invites a shallow pass over everything. | High | High | Build in dependency order — tokens, then primitives, then composites. A component is not done until it has a test and a gallery entry. Depth over breadth; report anything cut. |
| 2 | The RTL lint rule will flag existing Milestone 2 components. | Certain | Low | Fix them as part of the restyle. That is the point of adding the rule now rather than later. |
| 3 | Restyling auth screens silently changes behaviour. | Medium | High | Milestone 2 auth tests must pass **unmodified**. No test edits permitted in the restyle commit. |
| 4 | Chart palette fails colour-blind checks. | Medium | Medium | Choose by hue separation, verify under deuteranopia/protanopia simulation, and never rely on colour alone (`COMPONENT_DESIGN.md` §8). |
| 5 | Rich text and uploader pull backend scope forward. | High | Medium | Presentational layer only, stub port, documented limitation. |
| 6 | Tiptap and Recharts are heavy; bundle regresses. | Medium | Medium | Both lazy-loaded. Bundle delta measured against the Milestone 2 baseline and reported. |
| 7 | The gallery is mistaken for a product page. | Low | Medium | Dev-only, excluded from production builds, and a test asserts it 404s in production. |
| 8 | "Premium" is subjective; visual approval could stall. | Medium | Medium | `DESIGN_RULES.md` and `COMPONENT_DESIGN.md` are the written standard. Review against them, not against taste. |

---

## Definition of Done

Per `MILESTONE_RULES.md` §8, plus:

- [ ] All token debt above cleared
- [ ] Every PRD component category built, tested, and in the gallery
- [ ] `npm run typecheck` / `lint` / `test` / `test:e2e` / `build` green
- [ ] Zero axe violations across the gallery, both themes, both directions
- [ ] Milestone 2 auth tests pass unmodified
- [ ] Bundle delta measured and reported
- [ ] Gallery 404s in a production build
- [ ] `MILESTONE_03_COMPLETED.md` written
- [ ] **STOP** — visual review and approval before Milestone 4

---

## 2026-08-23 Structural Review Amendment

The sequential milestone audit reopened this plan after comparing the implementation
with the repository-wide rules. Functional and visual acceptance evidence remains
valid, but certification also requires:

- [x] Split `src/components/ui/chart.tsx` below the 300-line hard limit.
- [x] Remove avoidable raw-pixel and physical-direction utilities from the reusable
      primitives; retain exact third-party selectors only where they identify markup
      emitted by Radix/Recharts rather than define a design value.
- [x] Re-run the design-system tests, static gates, production build, and gallery E2E.
- [x] Record an authoritative repair addendum in the completion report.
