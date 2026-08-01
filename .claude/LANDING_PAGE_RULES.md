# Landing Page and Marketing Rules

The marketing surface has a different job from the product. The dashboard serves people
who already pay; the landing page converts people who have not decided. Same design
system, different application of it.

Tokens and principles: `DESIGN_TOKENS.md`, `DESIGN_RULES.md`. Motion: `MOTION_RULES.md`.

---

## 1. Where This Differs From the Product

| | Product (dashboard) | Marketing (landing) |
|---|---|---|
| Density | High — a tool used daily | Low — generous, spacious |
| Section spacing | `12`–`20` | `20`–`32` (160–256px) |
| Type scale | Body 15px, H1 32px | Body 17–18px, H1 56–72px |
| Motion | Functional only | Scroll-reveal permitted, sparingly |
| Colour | Restrained, one accent | One accent, still restrained |
| Goal | Complete a task | Take one action |

The visual language stays identical — same fonts, same radii, same colour tokens. A
landing page that looks like a different product than the app it sells is a broken
promise.

---

## 2. Structure

Order reflects how visitors actually read.

```
1  Nav                    sticky, glass, minimal
2  Hero                   claim + subclaim + one CTA + product proof
3  Social proof           logos or a number, immediately after the hero
4  Problem → solution     what breaks today, what this changes
5  Features               three to six, benefit-led
6  How it works           three steps, maximum
7  Testimonial            one strong, with a name, role, and face
8  Pricing                transparent
9  FAQ                    the objections that actually block purchase
10 Final CTA              repeat the hero action
11 Footer                 navigation, legal, trust marks
```

Not every page needs all eleven. Every page needs 1, 2, and 10.

---

## 3. The Hero

The only section most visitors read. It has roughly five seconds.

### Rules

- **The headline states the outcome, not the category.** "Never miss a customer message
  again" beats "AI-powered WhatsApp automation platform". Users buy the result.
- **Maximum eight words**, 56–72px desktop / 32–40px mobile, weight 600, tracking
  −0.02em to −0.03em. Tight tracking at display sizes is most of what separates a
  premium hero from a template.
- **Subheadline in one sentence**, 17–20px, `--muted-foreground`, max 60 characters
  per line. It says who it is for and how it works.
- **One primary CTA.** A second action may exist as a ghost button or a text link, never
  as a second filled button.
- **CTA text is specific**: "Start free trial" beats "Get started". "Book a demo" beats
  "Learn more".
- **Show the product.** A real screenshot or a short looping capture, above the fold on
  desktop. Abstract illustrations and 3D blobs convert worse than showing the thing.
- **Never a carousel.** Nobody sees slide two.
- **No hero video with sound.** No autoplay that delays paint.

### Layout

Centred for a single strong claim; split (copy left, product right) when the product
image carries weight. On mobile, always stack — copy first, image second, CTA visible
without scrolling.

---

## 4. Typography for Marketing

Larger and looser than the product.

| Role | Desktop | Mobile | Weight | Tracking |
|---|---|---|---|---|
| Hero | 64 | 36 | 600 | −0.03em |
| Section title | 40 | 28 | 600 | −0.02em |
| Feature title | 20 | 18 | 600 | −0.01em |
| Body | 17 | 16 | 400 | 0 |
| Caption / eyebrow | 13 | 13 | 500 | 0.05em, uppercase |

- **Eyebrow labels** above section titles ("HOW IT WORKS") give scanning structure —
  the one place uppercase tracking is correct. Note this does not work in Arabic
  (`RTL_I18N_RULES.md`).
- **Measure 60–75 characters.** Full-width paragraphs on a 1440px screen do not get read.
- **Never centre more than two lines** of body copy.

---

## 5. Section Rhythm

- Vertical padding `20`–`32` (160–256px) desktop, `12`–`16` mobile. **Marketing pages
  fail from being too tight far more often than too loose.**
- Alternate section backgrounds between `--background` and `--muted` to create rhythm —
  but never more than two consecutive same-background sections.
- **One idea per section.** If it needs two headlines, it is two sections.
- Content max width 1152px; text columns max 640px.

---

## 6. Motion

More permitted here than in the product, but the restraint rules still hold.

### Allowed

- **Scroll reveal**: fade + 12–16px rise, 400ms, triggered once at ~20% visibility.
  Never re-trigger on scroll back — that is nausea, not delight.
- **Stagger** within a section: 40–60ms between siblings, capped at ~6 elements.
- **Hover on cards and CTAs**, per `MOTION_RULES.md`.
- **A single looping product animation**, muted, paused off-screen.

### Forbidden

- Scroll-jacking or hijacked wheel behaviour.
- Parallax on anything other than a single background layer.
- Elements animating in from off-screen horizontally — causes overflow on mobile and
  breaks in RTL.
- Anything that delays Largest Contentful Paint.
- Counters that animate on every scroll into view.

`prefers-reduced-motion` disables all scroll reveal — content renders in final position
immediately. Content must never be invisible without JavaScript: animate from
`opacity: 1` as the no-JS baseline, or render server-side and enhance.

---

## 7. Pricing

- **Three tiers maximum.** Four is a decision users defer.
- **Highlight one** with a border, a badge, and slight elevation — not a wildly
  different size.
- **Prices are visible.** "Contact us" on every tier signals expensive and loses
  self-serve buyers. Enterprise may be "Contact us"; the others may not.
- **Feature lists are differences, not repetition.** "Everything in Starter, plus…"
  beats three near-identical lists.
- **Annual/monthly toggle shows the saving explicitly** ("Save 20%").
- **Currency follows locale** — SAR and AED matter for this product's market
  (`RTL_I18N_RULES.md`).
- **State what happens after the trial**, and whether a card is required. Hiding this
  costs trust and generates support load.

---

## 8. Performance — A Conversion Requirement

Marketing pages are judged by Core Web Vitals, and slow pages lose visitors before
they read anything.

| Metric | Target |
|---|---|
| LCP | < 1.8s |
| CLS | < 0.05 |
| INP | < 200ms |
| Total JS | < 120KB gzipped |

- **Statically rendered.** No client-side data fetching above the fold.
- **Hero image is `priority`** with explicit dimensions; everything below is lazy.
- **Modern formats** (AVIF/WebP) with correct `sizes`.
- **Self-hosted fonts**, `font-display: swap`, subset, preloaded. Two weights maximum.
- **No third-party script blocks paint** — analytics and chat widgets load after
  interaction or on idle.
- **Reserve space for everything** that loads late. CLS on a landing page is visible
  and cheap to avoid.

---

## 9. SEO and Metadata

- One `<h1>` per page, matching the hero headline.
- Unique `<title>` (under 60 chars) and meta description (under 155) per page.
- Open Graph and Twitter card images, 1200×630, showing the product and the claim.
- `Organization`, `Product`, and `FAQPage` structured data.
- Semantic landmarks — `<header>`, `<main>`, `<nav>`, `<footer>`. Screen readers and
  crawlers both rely on them.
- Canonical URLs; `hreflang` once Arabic ships.

---

## 10. Trust

A B2B buyer is assessing risk, not features.

- Real customer logos, with permission. Never placeholder logos.
- Testimonials with full name, role, company, and photograph. Anonymous quotes read as
  fabricated.
- Specific numbers over adjectives: "Replies in under 4 seconds" beats "Lightning fast".
- Security and compliance marks near the pricing and signup CTA, where hesitation peaks.
- Visible links to privacy policy, terms, and a real contact route.
- **No dark patterns.** No fake countdowns, no fake "3 people viewing", no pre-ticked
  consent, no cancellation buried three levels deep. These convert once and churn
  forever, and in the EU several are illegal.

---

## 11. Accessibility

`ACCESSIBILITY_RULES.md` applies in full — WCAG 2.2 AA is not relaxed for marketing.

Most frequently failed here:

- Low-contrast "subtle" hero text over an image or gradient (1.4.3).
- Scroll-reveal content that never appears for reduced-motion or no-JS users (1.1.1).
- Decorative icons announced by screen readers — mark them `aria-hidden` (1.1.1).
- Sticky nav obscuring focused links (2.4.11).
- Text baked into images, which cannot be zoomed, translated, or read aloud (1.4.5).
- Video without captions (1.2.2).

---

## 12. Milestone Position

**No landing page milestone exists in the PRD.** The 25 milestones cover the product
only. This is raised, not silently assumed.

The rules above apply whenever a marketing surface is built. If it is required before
launch, it needs a milestone of its own — building it inside a product milestone would
violate the scope rule in `RULES.md` §2.
