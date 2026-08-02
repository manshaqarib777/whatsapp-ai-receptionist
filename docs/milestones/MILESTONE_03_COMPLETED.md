# Milestone 3 — Completed

Completed: 2026-08-01
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 3`

---

## What Was Built

A token-driven component library covering every category the PRD lists, plus the
development-only gallery that makes "test visually" something a person can actually do.

Against the objective in the plan, all of the following are now true and were not
before:

- Every value in the UI comes from a token. Status colours, the chart palette, the
  two-layer elevation scale, and the named z-index scale exist rather than being
  referenced by documents that described them.
- Light and dark are both first-class, remembered across sessions, with no flash of the
  wrong theme on load.
- `prefers-reduced-motion` is honoured globally in CSS, and separately by the
  components that animate in JavaScript — where the CSS reset has no effect.
- Every component is checked by `axe` in its own test, and the assembled gallery is
  checked in both themes and both directions at five viewports.
- Milestone 2's auth screens are restyled onto the system, and Milestone 2's auth tests
  pass **unmodified** — the check that the restyle changed appearance and not
  behaviour.

**Scope changes**: none. The two interpretations flagged in the plan were resolved as
proposed there — a dev-only gallery rather than a product page, and presentational-only
rich text and upload layers.

---

## Files Created

### Components — composed, domain-agnostic (`src/components/`)

| Path | Purpose |
|---|---|
| `form-field.tsx` | `FormField` chrome (label, hint, error, aria wiring) and `TextField` |
| `date-picker.tsx` | Popover calendar with locale-aware, unambiguous formatting |
| `time-picker.tsx` | Fixed slots; canonical 24-hour value, localised display |
| `rich-text.tsx` | Tiptap editor whose schema is the allow-list, plus read-only rendering |
| `command-palette.tsx` | ⌘K / Ctrl+K palette over caller-supplied actions |
| `sidebar-nav.tsx` | Sidebar with route-derived active state and collapsed tooltips |
| `page-header.tsx` | Sticky header: title or breadcrumb, plus page actions |
| `app-shell.tsx` | Sidebar + mobile drawer + content column; cookie-persisted collapse |
| `charts.tsx` | Line, area, bar, sparkline — each with a screen-reader data table |
| `data-table.tsx` | Sorting, pagination, and table-shaped empty and loading states |
| `metric.tsx` | KPI tile that requires a comparison and colours by sentiment |
| `states.tsx` | `EmptyState`, `ErrorState`, `LoadingState` |
| `timeline.tsx` | Ordered event list with a connecting rail |
| `markdown.tsx` | `react-markdown`, raw HTML disabled, unsafe URL schemes stripped |
| `uploader.tsx` | Drag/drop plus keyboard route, previews, progress, validation |
| `theme-toggle.tsx` | Light / dark / system |

### Primitives (`src/components/ui/`)

accordion, breadcrumb, calendar, chart, checkbox, collapsible, command, dialog,
input-group, pagination, popover, progress, radio-group, scroll-area, select, sheet,
switch, table, tabs, textarea, toggle, tooltip.

### Other source

| Path | Purpose |
|---|---|
| `src/lib/motion.ts` | Easing, durations, and the shared entrance variants |
| `src/hooks/use-direction.ts` | Resolves the writing direction actually in effect |
| `src/providers/theme-provider.tsx` | `next-themes`, class strategy, no-flash script |
| `src/types/vitest-axe.d.ts` | `toHaveNoViolations` types for Vitest 4 |
| `src/app/(design)/layout.tsx` | Gallery shell; 404s unless the gallery is enabled |
| `src/app/(design)/design/page.tsx` | Gallery route |
| `src/features/design-system/fixtures.ts` | Product-shaped sample data |
| `src/features/design-system/components/section.tsx` | Gallery section chrome |
| `src/features/design-system/components/gallery-shell.tsx` | Composes the sections |
| `src/features/design-system/components/sections/*.tsx` | Nine specimen sections |

### Tests

`src/components/*.test.tsx` — 15 files, and `tests/e2e/design-system.spec.ts`.

---

## Files Modified

| Path | Change |
|---|---|
| `src/app/globals.css` | Status, chart, elevation, z-index tokens; `--radius` to 16px; reduced-motion reset; three contrast corrections; stronger sidebar active surface |
| `src/app/layout.tsx` | Theme provider and font wiring |
| `src/app/(auth)/layout.tsx` | Restyled onto the system — card surface, brand mark, theme switcher |
| `src/features/auth/components/*.tsx` | Swapped the local field for the shared `TextField` (6 files) |
| `src/features/auth/components/form-field.tsx` | **Deleted** — promoted to `src/components/form-field.tsx` |
| `src/features/health/components/system-status.tsx` | Loading region given `role="status"` |
| `src/components/ui/{alert,button,dropdown-menu,input}.tsx` | Physical direction utilities replaced with logical ones |
| `src/lib/env.ts` | `DESIGN_GALLERY` flag and `isDesignGalleryEnabled` |
| `eslint.config.mjs` | Error on physical direction utilities in `className` |
| `vitest.setup.ts` | `vitest-axe` matchers; jsdom shims Radix requires |
| `playwright.config.ts` | Second production server with the gallery enabled |
| `.env.example` | Documents `DESIGN_GALLERY` and that a deployment must never set it |
| `package.json` | See Dependencies below |

---

## Tests Completed

| Type | Count | Command |
|---|---|---|
| Unit + integration + component (whole project) | 390 in 29 files | `npm run test` |
| — of which design system | 149 in 15 files | `npx vitest run src/components` |
| E2E (whole project) | 118 across 2 projects | `npm run test:e2e` |
| — of which gallery | 36 | `npx playwright test tests/e2e/design-system.spec.ts` |

The E2E suite was run twice end to end after the last change, 118 passing each time. One
intermittent failure was seen during development and is explained in Defects §10 — it
was fixed, not retried.

Every component test asserts `axe` has nothing to report. The gallery is audited
against WCAG 2.0 A/AA, 2.1 A/AA, and 2.2 AA in light and dark, LTR and RTL.

**Deliberately not covered**

- The Tiptap editor is not rendered in a component test. ProseMirror needs layout APIs
  jsdom does not implement, and a mocked editor would prove nothing. Its
  security-relevant behaviour — the schema as allow-list — is tested directly against
  the parse/serialise path, which is where that guarantee lives.
- Visual regression (screenshot diffing) is not set up. Deferred deliberately: it needs
  a stable baseline environment, and the design is still under review.
- The uploader's `onUpload` port has no integration test because there is nothing to
  integrate with yet. See Known Limitations.

---

## Defects Found And Fixed

Recorded because each was real and each was found by a check rather than by chance —
the first six by a test, before anyone looked at the screen:

1. **The command palette threw on open.** `CommandDialog` provides the dialog, not the
   cmdk root, so every input and item inside it rendered without the context they
   require. The gallery looked fine until something opened the palette.
2. **The page header nested an `<li>` inside an `<li>`.** The browser silently
   reshuffles that, React then disagreed with its own server output, and it discarded
   and re-rendered that subtree on every load. Nothing looked wrong.
3. **Rendering a rich-text document with an unknown node crashed the page.**
   `generateHTML` throws rather than dropping unknown content, so a document written
   under an older schema would take the surrounding page down with it.
4. **Chart data tables caused horizontal overflow on a phone.** `sr-only` on a
   `<table>` does not clamp it — a full-width table sat off-screen and widened the
   document by up to 360px at 375px wide.
5. **Three tokens failed WCAG AA as text**: `--muted-foreground` at 4.34:1 on
   `--muted`, `--destructive` at 4.00:1 on its own tint, `--success` at 4.44:1 on white.
   All three are used for text; all three were darkened.
6. **Loading regions announced nothing.** `aria-label` on a bare `<div>` is invalid ARIA
   and is ignored, so four loading states were silent to a screen reader.

And three found by reviewing rendered screenshots, which no test would have caught:

7. **The sidebar's active item was nearly invisible in light mode** — `--sidebar-accent`
   at 0.97 lightness on a 0.985 rail. Darkened to 0.94. Dark mode already stepped
   clearly and was left alone.
8. **The time picker's value floated in the middle of its trigger** rather than sitting
   next to its icon, unlike every other control in the system.
9. **The sidebar specimen clipped its last navigation item**, which reads as a layout
   bug rather than as a specimen.

And one found by chasing a single intermittent E2E failure rather than re-running it:

10. **The gallery's animation section rendered different text on the server and the
    client.** It read `useReducedMotion()` for its status label, and the server cannot
    know that preference — so under reduced motion React discarded and rebuilt that
    subtree on load. The label now comes from CSS variants, which cannot disagree. The
    accessibility audit also runs with reduced motion emulated, so contrast is measured
    on the settled interface rather than mid-fade; that was almost certainly the cause
    of the original flake.

---

## Dependencies Added

| Package | For |
|---|---|
| `motion` | Animation primitives |
| `recharts` | Charts |
| `cmdk` | Command palette |
| `react-day-picker`, `date-fns` | Calendar and date picker |
| `@tanstack/react-table` | Table sorting, paging, selection |
| `react-markdown`, `remark-gfm` | Markdown |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` | Rich text |
| `vitest-axe` (dev) | Per-component accessibility assertions |
| `@axe-core/playwright` (dev) | Per-route accessibility audits |

`next-themes` was already present and is now used.

---

## Performance Results

Measured, not estimated. Method stated for each.

**Build**: 31.6 s from a cleared `.next` (`rm -rf .next && time npm run build`),
against 9.0 s at Milestone 2. TypeScript accounts for 12.2 s of it.

**Bundle** — `.next/static` grew from 1.4 MB to 3.2 MB. That figure is disk weight, and
on its own it overstates the user-facing cost, so measured per route by summing the
chunk sizes actually referenced in the served HTML:

| Route | JS referenced (uncompressed) | Chunks |
|---|---|---|
| `/` | 702 KB | 13 |
| `/login` | 1185 KB | 17 |

Neither Recharts nor Tiptap appears on either route — verified by grepping the chunks
each route requests. The two largest chunks in the build (972 KB and 381 KB) belong to
the gallery, which does not exist in production. They occupy CDN space; no user
downloads them.

`/login` is the heaviest user-facing route because it pulls the auth client and the
form primitives. Reducing it is Milestone 24 work (bundle budget), not a Milestone 3
regression to chase now — but it is above where it should end up, and is recorded here
so it is not discovered later as a surprise.

**E2E suite**: 118 tests in 1.0 min, two servers.

Webhook, AI, and query latency are not applicable to this milestone.

---

## Known Limitations

1. **Rich text is presentational.** No persistence, no storage adapter. The schema
   filter runs in the browser; whatever eventually accepts this content must run the
   same schema server-side before trusting it. Tracked to the milestone that adds
   storage.
2. **The uploader has no backend.** Client-side type and size validation is usability,
   not a control. Documented in the component and shown in the gallery so nobody
   mistakes it for one. Tracked to Milestone 24.
3. **The gallery is served in production behind an explicit flag.** `/design` 404s in a
   production build unless `DESIGN_GALLERY=enabled`. Only the E2E suite sets it, so it
   can audit real production markup rather than the development server's injected
   toolbar. A test asserts the default. This is a deviation from the plan, which said
   the gallery would be excluded from the production build outright: Next refuses to run
   a second development server against the same directory, so testing the gallery on a
   dev server would have meant killing a developer's `npm run dev` on every test run.
4. ~~**Control heights follow the installed compact scale, not `COMPONENT_DESIGN.md`.**~~
   **Resolved at the design review (2026-08-02): the compact scale stands.** Inputs and
   default buttons are 32px, against the 40px an earlier draft of `COMPONENT_DESIGN.md`
   §4 specified. The compact scale arrived with the shadcn preset in Milestone 1, every
   control follows it, and 32px still clears WCAG 2.2 §2.5.8 (24×24px minimum). §4 has
   been amended to document 28 / 32 / 36px as the scale, with a note not to revert it.
   No component changed.
5. **No visual regression testing.** See Tests Completed.
6. **`middleware.ts` is deprecated in Next 16** in favour of `proxy`. Unrelated to this
   milestone and untouched by it; noted because the build warns on every run.

---

## Exit Criteria

- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] `npm run test` — 390 passing
- [x] `npm run test:e2e` — 118 passing
- [x] `npm run build` — succeeds
- [x] Zero axe violations across the gallery, both themes, both directions
- [x] Milestone 2 auth tests pass unmodified
- [x] Bundle delta measured and reported
- [x] `/design` 404s in a production build without the explicit flag
- [x] `CHANGELOG.md` updated
- [ ] Exercised on a preview deployment — **not done**; no preview environment is
      configured yet. Exercised against a local production build instead, which is
      what the E2E suite runs against.
- [x] **STOP — visual review and approval** — approved 2026-08-02. The control-height
      question in Known Limitations §4 was decided at the same time: the compact scale
      stands.

---

## For The Reviewer

Run `npm run dev` and open <http://localhost:3000/design>. Use the two controls at the
top right to switch theme and direction. Worth a look specifically:

- **Tokens** — whether `--warning` reads as a warning in dark mode, and whether the
  elevation scale steps evenly rather than jumping.
- **Forms** — the error state, and whether the reserved error space looks deliberate
  rather than like a gap.
- **Charts** — whether the categorical palette separates cleanly, including under a
  colour-blindness simulator.
- **Navigation** — the sidebar's active state at a glance, and the collapsed rail.
- **Animations** — press "Replay". If anything feels like a bounce or a swoop, it is
  wrong.
- **Control heights** — settled on the compact 28/32/36px scale; see Known Limitations
  §4. Worth a glance to confirm it reads as intentional at full-page scale.
