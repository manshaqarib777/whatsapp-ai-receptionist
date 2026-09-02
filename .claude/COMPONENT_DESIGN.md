# Component Design

Per-surface visual specifications. `UI_RULES.md` covers component *construction*
(props, states, layering); this file covers what each surface must *look* like.

Tokens: `DESIGN_TOKENS.md`. Principles: `DESIGN_RULES.md`.

---

## 1. Visual Hierarchy

Every screen answers, within one second: **where am I**, **what matters most**, **what
do I do next**.

### The ordering tools, in order of strength

1. **Size** — strongest. One dominant element per view.
2. **Weight** — 600 against 400 separates more cleanly than two sizes.
3. **Colour** — `--foreground` vs `--muted-foreground` does most of the work.
4. **Space** — proximity groups; distance separates. Stronger than a divider line.
5. **Elevation** — reserve for genuinely floating layers.
6. **Position** — top-left (LTR) reads first.

### Rules

- **One primary action per view.** One filled button. Everything else is outline,
  ghost, or a link. Two primary buttons means neither is primary.
- **Three levels of text, no more**: title (`--foreground`, 600), body
  (`--foreground`, 400), meta (`--muted-foreground`, 13px). A fourth level is noise.
- **Dividers are a last resort.** Try space first, then a background change, then a
  hairline. Stacked dividers make a page look like a spreadsheet.
- **Establish scanning rhythm.** Consistent vertical spacing between peer elements
  lets the eye skip. Irregular spacing forces reading.
- **Squint test.** Blur the screen. The most important thing should still stand out. If
  everything is equally grey, hierarchy has failed.

---

## 2. Component Spacing

The 8-point grid (`DESIGN_RULES.md`) applied per surface. Consistency here is the
difference between "designed" and "assembled".

| Context | Padding | Gap between children |
|---|---|---|
| Button (sm / md / lg) | `2 3` / `2.5 4` / `3 6` | `2` icon-to-label |
| Input | `2.5 3` | — |
| Card | `6` (`4` on mobile) | `4` |
| Card header → body | — | `4` |
| Modal | `6` | `5` |
| Table cell | `3 4` | — |
| Sidebar item | `2 3` | `3` icon-to-label |
| Page (mobile / desktop) | `6` / `8`–`12` | — |
| Section → section | — | `12`–`20` |
| Form field → field | — | `5` |
| Label → input | — | `2` |
| Input → error text | — | `1.5` |

**Icon-to-label is always `2` (8px).** Nothing looks more amateur than inconsistent
icon gaps across a UI.

**Optical alignment beats mathematical alignment.** Icons often need 1px of nudge to
look centred. Trust the eye.

---

## 3. Cards

The most repeated surface in the product. Getting it right propagates everywhere.

```
┌─────────────────────────────────┐
│  Title                    ⋯     │  header: 600 weight, action right
│  Description                    │  --muted-foreground, 13px
│                                 │  gap 4
│  ─────── content ───────        │
│                                 │  gap 4
│  [Secondary]        [Primary]   │  footer: actions right (LTR)
└─────────────────────────────────┘
```

| Property | Value |
|---|---|
| Radius | `--radius-lg` (16px) |
| Padding | `6` desktop, `4` mobile |
| Background | `--card` |
| Border | 1px `--border` |
| Shadow | `--shadow-sm` at rest |
| Hover (interactive only) | `--shadow-md`, border → `--border-strong`, 160ms |

### Rules

- **Border and shadow, not border or shadow.** A hairline defines the edge; the shadow
  gives it lift. Shadow alone reads as blurry in light mode.
- **Only interactive cards respond to hover.** A static card that lifts on hover
  promises a click that does not exist.
- **An interactive card is a `<button>` or `<a>`** — never a `<div>` with `onClick`.
- **Never nest a card in a card.** Use a bordered section or a background shift.
- **Cards in a grid are equal height.** Ragged bottoms look broken. Use
  `grid` + `items-stretch`, and let the content area flex.
- **A card needs a title.** An untitled card is a `<div>` with a border.

---

## 4. Forms

Behaviour and validation are in `UI_RULES.md` → Forms. This is the visual spec.

```
Label                          ← 13px, 500, --foreground, gap 2 below
┌───────────────────────────┐
│ Placeholder               │  ← h-8, radius-lg, --input border
└───────────────────────────┘
Helper or error text           ← 12px, gap 1.5 above
```

| Property | Value |
|---|---|
| Height | 32px (`h-8`) default; 36px (`h-9`) large, 28px (`h-7`) dense |
| Radius | `--radius-lg` |
| Border | 1px `--input` |
| Focus | 2px `--ring`, `outline-offset: 2px` — **never** `outline: none` alone |
| Error | Border `--destructive`, ring `--destructive`, message below |
| Disabled | 50% opacity, `cursor: not-allowed`, no hover response |

### Rules

- **The control scale is compact — 28 / 32 / 36px — and it is deliberate.** It arrived
  with the shadcn preset in Milestone 1, every control in the system follows it, and it
  was ratified at the Milestone 3 design review. An earlier draft of this document
  specified 40px; that was never what shipped. Do not "restore" 40px. At 32px the
  controls still clear WCAG 2.2 §2.5.8 Target Size (Minimum), which asks for 24×24px.
- **Labels are always visible**, above the field. Not placeholders, not floating
  labels — both fail for screen readers and both vanish exactly when the user needs
  them (mid-typing).
- **Single column.** Side-by-side fields halve completion rates. Exceptions: genuinely
  paired values (first/last name, city/postcode, start/end date).
- **Field width signals expected input.** A postcode field the width of the viewport
  is a lie. Constrain to plausible content length.
- **Required is marked, optional is not** — or vice versa, but never both, and never
  neither. Prefer marking optional when most fields are required.
- **Errors appear below the field**, in `--destructive`, describing the *fix* — "Enter
  a phone number including country code", not "Invalid input".
- **Error messages never shift layout.** Reserve the space or animate height.
- **Submit is bottom-right** in a modal, bottom-left in a page form (aligned to the
  field column).
- **Group with a heading and space**, not a `<fieldset>` border, unless the grouping is
  semantically meaningful for screen readers.

---

## 5. Tables

Where SaaS products most often look generic. The default `<table>` is not acceptable.

```
┌──────────────────────────────────────────────────────┐
│ ▢  Customer      Status      Updated       Value   ⋯ │  ← sticky, --muted bg
├──────────────────────────────────────────────────────┤
│ ▢  Acme Ltd      ● Active    2 hours ago   1,240.00  │  ← h-14, hover --accent
│ ▢  Globex        ● Pending   Yesterday       880.00  │
└──────────────────────────────────────────────────────┘
   Showing 1–20 of 143                    ‹ 1 2 3 ... ›
```

| Property | Value |
|---|---|
| Row height | 56px comfortable / 44px compact |
| Header | `--muted` background, 12px, 500, `--muted-foreground`, sticky |
| Row hover | `--accent` background, 100ms |
| Row border | 1px `--border` bottom only |
| Cell padding | `3 4` |
| Selected row | `--accent` + 2px `--primary` inline-start marker |

### Rules

- **No vertical gridlines.** Horizontal rules only — and consider none at all, letting
  row height do the separating. Full grids are spreadsheets.
- **No zebra striping.** It is a workaround for rows that are too tight. Fix the height
  instead.
- **Numbers right-aligned, tabular figures, consistent decimals.** Text left-aligned.
  A ragged column of numbers is unreadable.
- **Dates are relative up to a week** ("2 hours ago"), absolute after. Always give the
  exact timestamp in a `title` attribute.
- **Status is a badge, never bare text** — and never colour alone (`DESIGN_RULES.md`).
- **Row actions appear on hover** at the row end, but are **always present for keyboard
  users** — `opacity-0 group-hover:opacity-100 focus-within:opacity-100`. Hover-only
  actions that keyboard users cannot reach are an accessibility failure, not a
  refinement.
- **Sticky header** on any table that scrolls. Sticky first column when horizontal
  scrolling is unavoidable.
- **Column widths are deliberate.** `table-layout: fixed` with explicit widths;
  `auto` reflows as data changes and looks unstable.
- **Truncate with a tooltip**, never wrap to a second line — variable row heights
  destroy scanning rhythm.
- **Virtualise past 100 rows** (`UI_RULES.md` → Performance).
- **Mobile: tables become cards.** A horizontally scrolling table on a phone is a
  failure. Each row becomes a card with labelled fields.
- **Empty, loading, and error states are table-shaped** — a skeleton with the real
  column widths, not a spinner in a blank box.

---

## 6. Sidebar and Navigation

```
┌──────────────────┐
│ ◈ Workspace   ▾  │  ← workspace switcher, h-14
├──────────────────┤
│ ⌕ Search    ⌘K   │  ← palette trigger
│                  │
│ MAIN             │  ← section label, 11px, 500, uppercase, tracking 0.05em
│ ▣ Dashboard      │  ← h-9, radius-md, gap 3
│ ▣ Inbox      12  │  ← count badge, end-aligned
│ ▣ Contacts       │
│                  │
│ MANAGE           │
│ ▣ Settings       │
├──────────────────┤
│ ◯ Alex Chen   ▾  │  ← account menu, pinned bottom
└──────────────────┘
```

| Property | Value |
|---|---|
| Width | 260px expanded, 64px collapsed |
| Background | `--sidebar` |
| Border | 1px `--sidebar-border` inline-end |
| Item height | 36px |
| Item radius | `--radius-md` |
| Active | `--sidebar-accent` background, `--sidebar-accent-foreground` text, 500 |
| Hover | `--sidebar-accent` at 50% |

### Rules

- **Active state is unmistakable.** Background *and* weight *and* icon colour. A subtle
  active state means users lose their place constantly.
- **Active state derives from the route**, never from click state — deep links and
  back-navigation must highlight correctly.
- **Maximum two levels.** Three-level nesting means the information architecture is
  wrong. Use a section header plus flat items.
- **Group with labels and space**, not dividers.
- **Counts are muted, not alarming** — `--muted-foreground` on `--muted`. Reserve
  `--destructive` for genuinely urgent counts.
- **Collapsed mode shows icons with tooltips**, and the tooltip is the accessible name.
- **Collapse state persists** across sessions.
- **Mobile: sidebar becomes a drawer** behind a menu button, or a bottom tab bar for
  the top four destinations. Never a squeezed desktop sidebar.
- **The sidebar never scrolls independently unless it must** — pin the account menu to
  the bottom, scroll only the item list.

### Header

Sticky, 56–64px, `--background` with `backdrop-blur` (glass — see `DESIGN_RULES.md`),
hairline bottom border. Contains breadcrumb or page title, and page-level actions at
the end. It does **not** duplicate sidebar navigation.

### Breadcrumbs

Only when hierarchy exceeds two levels. Current page is not a link. Truncate the
middle, never the ends.

---

## 7. Dashboard Design

The dashboard is Milestone 5 and is what users see most.

### Layout

```
┌────────────────────────────────────────────────────┐
│  Good morning, Alex                    [Date ▾]    │  greeting + global filter
│                                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │  KPI row — 4 across
│  │ 1,284  │ │  94%   │ │ 2m 14s │ │  18    │       │
│  │ ▲ 12%  │ │ ▲ 3%   │ │ ▼ 8%   │ │ ▬ 0%   │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                    │
│  ┌──────────────────────────┐ ┌─────────────────┐  │  primary chart 2/3
│  │  Conversations over time │ │  Activity feed  │  │  secondary 1/3
│  │                          │ │                 │  │
│  └──────────────────────────┘ └─────────────────┘  │
│                                                    │
│  ┌────────────────────────────────────────────┐    │  table, full width
│  │  Recent conversations                      │    │
│  └────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

### Rules

- **Most important information top-left** (LTR). Users scan in an F-pattern; do not
  bury the headline metric below the fold.
- **Four KPIs maximum in the top row.** Six is a wall of numbers nobody reads.
- **Every metric carries a comparison.** "1,284" is trivia. "1,284, up 12% on last
  week" is information. Include the comparison period in the label.
- **Deltas use icon + sign + colour**, never colour alone. And **down is not always
  bad** — response time falling is good. Colour by *sentiment*, not by direction.
- **One question per widget.** A widget that needs a paragraph of explanation is two
  widgets.
- **Loading is per-widget, not per-page.** A single page spinner blocks everything on
  the slowest query. Each widget skeletons independently.
- **Failure is per-widget too.** A failed chart shows a failed chart; the rest of the
  dashboard still works (`CODING_STANDARDS.md` → Error Boundaries).
- **Empty state is a first-run experience**, not an apology. A new tenant sees guidance
  toward the first action, not "No data available".
- **Date range is global and persisted**, at the top, applying to every widget. Never
  per-widget pickers that can disagree with each other.
- **Everything is a doorway.** A KPI links to its filtered detail view. Dead-end
  numbers frustrate.

### SaaS dashboard best practices

- **Time-to-first-value is the metric.** A new user should reach something useful in
  under 60 seconds. Onboarding checklists beat empty dashboards.
- **Seed demo data for empty tenants** so the product never looks broken on day one —
  clearly labelled as sample, with one-click dismissal.
- **Surface the account state** — plan, usage against quota, trial days remaining —
  without nagging. One persistent, dismissible element maximum.
- **Recent-activity beats all-activity.** Ten relevant rows with a "view all" link
  outperform a hundred rows.
- **Design for the multi-tenant case.** Every dashboard must work for one branch and
  for twenty (Milestone 18).
- **Density is a user preference**, not a designer's choice. Offer comfortable and
  compact, and remember it.

---

## 8. Charts and Analytics

"Beautiful charts" is a PRD requirement. It is mostly restraint.

### Structural rules

- **Remove everything that is not data.** No chart borders, no background fill, no 3D,
  no drop shadows on bars, no gradient fills unless they encode something.
- **Gridlines are horizontal only**, 1px `--chart-grid`, and only as many as needed to
  read values — usually 4 or 5. Vertical gridlines almost never help.
- **No axis line where the gridline already implies it.**
- **Label directly where possible.** A line labelled at its end beats a legend the eye
  must travel to. Reserve legends for 5+ series.
- **Y-axis starts at zero for bars.** A truncated bar axis misrepresents magnitude.
  Line charts may truncate, but must make it obvious.
- **Sort bars by value**, not alphabetically, unless the category order is meaningful
  (days of the week).
- **Format axis numbers**: `1.2k`, `£4.8m` — never `1200.00000`.

### Colour

- Categorical palette from `--chart-1`…`--chart-8` (`DESIGN_TOKENS.md`).
- **Maximum 6 categorical series.** Beyond that, group into "Other".
- **Verify under deuteranopia and protanopia** — around 8% of men are affected. Also
  vary line style or marker shape so colour is never the only differentiator.
- **Sequential data uses a single-hue ramp**, diverging data a two-hue ramp with a
  neutral midpoint. Never a rainbow.
- **Semantic consistency across the product**: if resolved is green in one chart, it is
  green everywhere.

### Interaction

- **Hover shows a tooltip with the exact value**, the series name, and the period.
  Charts are for shape; tooltips are for precision.
- **Crosshair on time series**, snapping to the nearest data point.
- **Legend items toggle series** and are real `<button>`s.
- **Tooltip follows the cursor but never covers the point** it describes.

### Accessibility

A chart is an image to a screen reader unless you make it otherwise:

- Wrap in `role="img"` with an `aria-label` **summarising the trend**, not the data
  ("Conversations rose 12% over 30 days, peaking on 14 March").
- Provide the underlying data as a visually-hidden `<table>`, or a "view as table"
  toggle. This is the accessible equivalent, not a nice-to-have.
- Never rely on hover alone to expose values — keyboard users must be able to step
  through data points with arrow keys.

### Chart type selection

| Question | Chart |
|---|---|
| How has this changed over time? | Line (or area if cumulative) |
| How do categories compare? | Horizontal bar (vertical only for time) |
| What is the composition? | Stacked bar — **not** pie, beyond 3 slices |
| How are values distributed? | Histogram or box plot |
| Where do users drop off? | Funnel |
| A single number vs a target? | Big number + sparkline. Not a gauge. |

Never a pie chart with more than three slices. Never a donut with a number in the
middle when the number alone would do.

---

## 9. Badges, Toasts, Modals

### Badges

Height 22px, padding `0.5 2`, radius `--radius-sm`, 12px / 500. Status badges use
`-subtle` background with solid foreground, plus a dot or icon. Never colour alone.

### Toasts

Bottom-right (bottom-centre on mobile), `--shadow-lg`, max 420px. Auto-dismiss after
5s for success, **never** for errors — errors require acknowledgement. Maximum three
stacked; collapse beyond that. Every toast with an action has that action reachable by
keyboard. Toasts never carry critical information that exists nowhere else.

### Modals and sheets

Radius `--radius-xl`, padding `6`, `--shadow-lg`, backdrop `oklch(0 0 0 / 0.4)` with a
slight blur. Max width 560px for forms, 720px for content. Enter: fade + 4px rise +
0.98→1 scale over 220ms. Focus trapped, `Escape` closes, focus returns to the trigger
(`UI_RULES.md`).

**Sheets over modals on mobile** — bottom sheets respect thumb reach; centred modals
do not.

**Never nest modals.** A modal that opens a modal is a flow that needs redesigning.
