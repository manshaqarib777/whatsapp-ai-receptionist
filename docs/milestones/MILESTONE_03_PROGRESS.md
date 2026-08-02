# Milestone 3 — Progress

Status: Complete — awaiting visual review
Started: 2026-08-01
Last updated: 2026-08-01

See `MILESTONE_03_COMPLETED.md` for the closing report.

## Completed Tasks

- [x] Token debt cleared — `--radius: 1rem`, status colours (`--success` / `--warning`
      / `--info` with `-foreground` and `-subtle`), categorical chart palette,
      `--elevation-xs…xl` two-layer shadows, `--z-*` scale, `prefers-reduced-motion`
      global reset (`src/app/globals.css`)
- [x] No-flash theme: `next-themes` provider + `ThemeToggle` (light / dark / system)
- [x] Motion primitives — `src/lib/motion.ts` (easing, durations, fade/scale/stagger)
- [x] ESLint rule forbidding physical direction utilities (RTL)
- [x] shadcn primitives installed: accordion, breadcrumb, calendar, chart, checkbox,
      collapsible, command, dialog, input-group, pagination, popover, progress,
      radio-group, scroll-area, select, sheet, switch, table, tabs, textarea, toggle,
      tooltip
- [x] Composites: charts (trend / comparison / sparkline with table fallback),
      data table, markdown, metric, states (empty / error / loading), timeline,
      uploader
- [x] Shared `FormField` / `TextField` promoted out of `features/auth`
- [x] Date picker (popover calendar) and time picker (fixed slots)
- [x] Rich text editor (Tiptap, schema-as-allow-list), lazy-loaded
- [x] Command palette (⌘K / Ctrl+K)
- [x] Sidebar (260/64px, route-derived active state, collapse persistence, mobile
      drawer), sticky page header, and application shell
- [x] Animations section in the gallery, honouring `prefers-reduced-motion`
- [x] Gallery split into nine sections — the single file had passed the 300-line limit
      in `CODING_STANDARDS.md`
- [x] Auth screens restyled — Milestone 2's 128 auth tests pass unmodified
- [x] `vitest-axe` wired into the test setup, with Vitest 4 matcher types
- [x] Component tests: 149 across 15 files, each asserting zero axe violations
- [x] Sanitisation tests: 13 markdown and 14 rich-text cases against XSS payloads
- [x] Theme integration tests: applied to the document, and persisted
- [x] E2E: 36 gallery tests — both themes, both directions, five viewports, keyboard
      traversal, hydration-error guard, and the production 404
- [x] Lint clean at zero warnings
- [x] Bundle delta measured per route, not just on disk
- [x] `CHANGELOG.md` entry and `MILESTONE_03_COMPLETED.md`

## Pending Tasks

- [x] Decision on control heights — resolved 2026-08-02: compact 28/32/36px scale
      stands, `COMPONENT_DESIGN.md` §4 amended to match. No component changed.
- [ ] Visual review and approval — **STOP** before Milestone 4
- [ ] Preview deployment — deferred; no preview environment exists yet

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `useReactTable` trips React Compiler's `incompatible-library` rule; exit criteria demand zero warnings | Resolved | The compiler correctly declines to memoise the table (memoising would serve stale rows). Documented and disabled at that one call site rather than weakening the rule globally. |
| 2 | shadcn's vendored `calendar.tsx` had an unchecked effect dependency | Resolved | Hoisted `modifiers['focused']` into a named variable so the dependency is statically checkable. |
| 3 | PRD says "no pages, only components" but also "test visually" | Resolved | Dev-only gallery at `/design`. Flagged in the plan, not silently resolved. |
| 4 | Command palette threw on open — `CommandDialog` supplies the dialog, not the cmdk root | Resolved | Wrapped the palette's contents in `Command`. Found by a component test before visual review. |
| 5 | `PageHeader` nested `<li>` inside `<li>`, causing a hydration mismatch on every load | Resolved | Separator rendered as a sibling. An E2E console guard now fails on any page error. |
| 6 | `richTextToHtml` threw on an unknown node instead of dropping it — a stored document could crash the page rendering it | Resolved | `rewriteUnknownContent` on a copy before rendering. |
| 7 | Chart `sr-only` tables widened the document by up to 360px on a phone | Resolved | `sr-only` moved to a wrapping `div`; a table ignores the 1px clamp. |
| 8 | `--muted-foreground`, `--destructive`, `--success` failed WCAG AA as text (4.34, 4.00, 4.44) | Resolved | Darkened all three; re-audited at zero violations. |
| 9 | Four loading regions used `aria-label` on a bare `div` — invalid ARIA, silently ignored | Resolved | `role="status"` added. |
| 10 | Gallery E2E could not run against the production build (`/design` 404s), and Next refuses a second dev server for the same directory | Resolved | `DESIGN_GALLERY=enabled` serves it from a second production server; the default server asserts the 404. Recorded as a deviation from the plan. |
| 11 | `/design` was prerendered, so the runtime flag had no effect | Resolved | `export const dynamic = 'force-dynamic'` — a runtime decision has to run at runtime. |
| 12 | One intermittent E2E accessibility failure (dark, mobile) | Resolved | Not reproducible in isolation or over six repeats. Chased rather than retried: the audit now emulates reduced motion, which exposed a real hydration mismatch — the gallery's animation label branched on `useReducedMotion()`, which the server cannot know. Label moved to CSS variants; two consecutive full suites clean afterwards. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-01 | `next-themes` for theming | Ships the blocking pre-paint script that removes the flash of wrong theme | Hand-rolled script — same code, more to maintain |
| 2026-08-01 | Chart palette by hue separation in OKLCH | Stays distinguishable under deuteranopia/protanopia; perceptually even lightness | Default shadcn greyscale placeholders — indistinguishable in a multi-series chart |
| 2026-08-01 | Charts ship an accessible table fallback | A canvas chart is invisible to a screen reader (`COMPONENT_DESIGN.md` §8) | `aria-label` on the chart only — describes existence, not data |
| 2026-08-01 | Two-layer shadows | A single-layer shadow is the strongest "generic Bootstrap" signal (`DESIGN_TOKENS.md` §4) | Single layer |
| 2026-08-01 | Rich text stores ProseMirror JSON, not HTML | The schema re-filters on the way out, so a value written under a laxer schema is cleaned by today's rules | Storing HTML — freezes whatever was allowed the day it was saved |
| 2026-08-01 | Hand-written sidebar rather than shadcn's | The spec in `COMPONENT_DESIGN.md` §6 is precise (260/64px, section labels, muted counts, collapsed tooltips); shadcn's would also have overwritten our customised button and tooltip | `npx shadcn add sidebar` |
| 2026-08-01 | Time picker offers slots rather than free text | Appointments are booked on boundaries a business offers; free text is a parsing problem in every locale | `<input type="time">` — unstylable and inconsistent across browsers |
| 2026-08-01 | Sidebar collapse persists in a cookie | The server can read it, so the first paint is the right width | `localStorage` — readable only after hydration, so the rail visibly snaps on every load |
| 2026-08-01 | Tiptap lazy-loaded via `next/dynamic` | Heaviest dependency in the system and most screens never show an editor | Static import |
| 2026-08-01 | Gallery served from a production build behind `DESIGN_GALLERY` | Lets the audit run against real production markup instead of the dev server's injected toolbar | A dev server for the gallery — Next refuses a second one, which would mean killing the developer's own |

## Database Changes

None. This milestone is presentation only.

## API Changes

None.

## Breaking Changes

None. `DESIGN_GALLERY` is new and defaults to disabled.
