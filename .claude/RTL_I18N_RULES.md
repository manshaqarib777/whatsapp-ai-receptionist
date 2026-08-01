# RTL and Internationalisation Rules

**Arabic (RTL) is a first-class locale, not a later port.**

The PRD places HyperPay, PayTabs, and STC Pay in Milestone 12 — these are Gulf and
Saudi payment providers. A WhatsApp receptionist for that market that only renders
left-to-right is not shippable there. Retrofitting RTL across twenty features costs
many times what building for it costs now.

**Every component built from Milestone 3 onward must work in RTL on the day it is
written.**

---

## 1. Logical Properties — The Core Rule

Never use physical direction properties. Use logical ones, which flip automatically.

| Never | Always |
|---|---|
| `margin-left` | `margin-inline-start` (`ms-*`) |
| `margin-right` | `margin-inline-end` (`me-*`) |
| `padding-left` | `padding-inline-start` (`ps-*`) |
| `padding-right` | `padding-inline-end` (`pe-*`) |
| `left` / `right` | `inset-inline-start` / `-end` (`start-*` / `end-*`) |
| `text-align: left` | `text-align: start` (`text-start`) |
| `border-left` | `border-inline-start` (`border-s`) |
| `border-radius: 0 8px 8px 0` | `border-start-end-radius` etc. |

Tailwind v4 supports the logical utilities natively — `ps-4`, `me-2`, `start-0`,
`text-start`, `border-s`. **`pl-4` and `ml-2` are lint failures**, not style preferences.

Vertical properties (`mt`, `mb`, `top`, `bottom`) are unaffected — RTL flips the inline
axis only.

---

## 2. What Flips and What Does Not

### Flips

- Layout order — sidebar moves to the right; content to the left.
- Text alignment and paragraph direction.
- Icons implying **direction**: chevrons, arrows, back/forward, indent, next/previous.
- Progress bars, sliders, carousels, breadcrumb separators.
- Table column order.
- Drawer and sheet entry edge.
- Tab order (follows visual order automatically once the DOM is correct).

### Does **not** flip

- **Time.** A clock icon, a media scrubber, and a calendar's day progression stay LTR.
  Arabic readers expect a timeline to run left-to-right.
- **Numbers.** Digits are always LTR, even inside Arabic text. `+966 50 123 4567`
  reads the same in both directions.
- **Charts with a time axis.** Time runs left-to-right. Category axes may flip.
- **Logos, brand marks, photographs.**
- **Media controls** — play always points right.
- **Code, URLs, email addresses, file paths.**
- **Checkmarks, spinners, and non-directional icons.**

A blanket `transform: scaleX(-1)` on all icons is the classic mistake — it mirrors
clocks and reverses play buttons.

---

## 3. Implementation

### Direction is set on the document

```tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

Both `lang` and `dir` are required. `lang` selects the screen reader voice
(`ACCESSIBILITY_RULES.md`); `dir` drives the bidi algorithm. Setting one without the
other is a common half-fix.

### Never hardcode a check

```tsx
// Wrong — every component now needs to know about locale
const isRtl = locale === 'ar';
<div className={isRtl ? 'mr-4' : 'ml-4'} />

// Right — the property already knows
<div className="ms-4" />
```

Directional *icons* are the one legitimate exception, and belong in one shared helper
rather than scattered ternaries:

```tsx
// src/lib/direction.ts
export function DirectionalChevron({ className }: { className?: string }) {
  // rtl:rotate-180 flips only where the document direction is rtl
  return <ChevronRight className={cn('rtl:rotate-180', className)} aria-hidden />;
}
```

### Bidi text

Mixed Arabic and Latin content — a customer name inside an English sentence, a phone
number inside an Arabic message — is where RTL bugs are most visible.

- Wrap user-generated content of unknown direction in `<bdi>`. It isolates the run so
  a name cannot reorder the sentence around it.
- Use `unicode-bidi: isolate` (`dir="auto"`) on message bubbles, contact names, and
  free-text fields, so each takes direction from its own content.
- **Never concatenate translated strings.** `"Hello " + name` reorders unpredictably in
  RTL. Use full interpolated templates.

### Numerals

Arabic uses both Western (`0123456789`) and Eastern Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`)
digits, by region. Do not choose by hand — use `Intl.NumberFormat` with the locale, and
`Intl.DateTimeFormat` for dates. Saudi Arabia commonly uses Western digits in business
contexts; do not assume.

Phone numbers, invoice IDs, and OTP codes stay Western regardless — they are
identifiers, not quantities.

### Typography in Arabic

- Arabic has **no capital letters** — uppercase styling on labels
  (`COMPONENT_DESIGN.md` → Sidebar) has no effect and must not be relied on for
  hierarchy. Use weight and colour.
- Arabic glyphs need **more vertical space**. Increase line-height by roughly 0.2 for
  Arabic; 1.5 becomes ~1.7. Fixed-height buttons and badges will clip otherwise.
- Arabic is **cursive** — letters join. Never apply `letter-spacing` to Arabic text; it
  breaks the joins and renders the word unreadable. The negative tracking on headings
  in `DESIGN_RULES.md` must be disabled for `[lang="ar"]`.
- Inter does not cover Arabic. Load a proper Arabic face (IBM Plex Sans Arabic, Noto
  Sans Arabic, or Cairo) and pair it in the font stack for `lang="ar"`.
- Arabic text runs roughly 20–25% longer than English. Layouts must not assume label
  length — this is the most common source of RTL layout breakage.

### Shadows and animation

- Directional shadows (`0 4px 12px -2px`) are vertical here, so they are unaffected.
  Any shadow with an X offset must be mirrored.
- Slide animations flip: a sheet entering from `x: 100%` must enter from `x: -100%` in
  RTL. Prefer animating a logical property, or read `dir` once in the motion helper.

---

## 4. Translation Rules

- **No hardcoded user-facing strings.** Every string goes through the translation layer
  from the first component. Retrofitting is far more expensive.
- Keys are semantic (`inbox.emptyState.title`), never English text as the key.
- **Never concatenate.** Full sentences with interpolation only.
- Handle plurals with the ICU plural rules — Arabic has **six** plural forms (zero,
  one, two, few, many, other) against English's two. A naive `count === 1` check is
  wrong in Arabic.
- Dates, times, currencies, and numbers go through `Intl`, never manual formatting.
- Include the timezone — the Gulf spans UTC+3 to UTC+4, and appointment booking
  (Milestone 9) is unforgiving here.

---

## 5. Verification

Every component test and E2E suite runs in **both** directions.

```tsx
// Component tests: render inside a dir="rtl" wrapper
render(<Component />, {
  wrapper: ({ children }) => <div dir="rtl">{children}</div>,
});
```

```ts
// Playwright: an RTL project alongside chromium/mobile
{ name: 'rtl', use: { ...devices['Desktop Chrome'], locale: 'ar-SA' } }
```

### Per-component checklist

- [ ] No physical direction utilities (`pl-`, `mr-`, `left-`, `text-left`).
- [ ] Renders correctly under `dir="rtl"` — no overlap, no clipping, no off-screen content.
- [ ] Directional icons flip; clocks, media controls, and logos do not.
- [ ] Numbers and phone numbers remain LTR.
- [ ] No horizontal overflow at 375px in RTL (`ACCESSIBILITY_RULES.md` 1.4.10).
- [ ] Tested with a long Arabic string — roughly 25% longer than the English.
- [ ] No `letter-spacing` applied to Arabic text.

### Enforcement

Milestone 3 adds an ESLint rule forbidding physical direction utilities in `className`.
Convention alone will not hold across twenty features — this must be mechanical, in the
same way `process.env` and Prisma imports are already restricted
(`CODING_STANDARDS.md` → Forbidden).

---

## 6. Milestone Position

Full localisation is not scheduled in the PRD's 25 milestones. That is a **gap in the
roadmap**, raised rather than silently absorbed.

Recommended split:

- **Milestone 3 (Design System)** — build every component RTL-correct, add the lint
  rule, add the RTL test project. Cost here is near zero.
- **A dedicated localisation milestone** — translation infrastructure, Arabic font
  loading, `Intl` formatting, plural rules, locale switching. Best placed before
  Milestone 12 (payments), since that is where the Gulf market becomes explicit.

Building RTL-correct components now costs almost nothing. Retrofitting after Milestone
21 costs a rewrite of every screen.
