# Design language: Workshop Ledger

This is the *why* behind how Toolwright looks and feels. For the *how* (tokens, components, code), see [design-system.md](design-system.md).

![The home page: display headline on a lime marker, a working bench, a ruler](images/home-light.png)

## The idea

Toolwright is **a tool catalogue kept by a careful workshop**.

A *wright* is a maker. The site should feel like something made by people who care about their tools: warm paper, black ink, one patina-green accent and a highlighter-lime marker. Tools are listed in a **ledger**, not displayed as glossy cards. Surfaces are **printed parts with labels**: ruled strips, crop marks, catalogue numbers. Buttons are slightly physical: they lift on hover and press flat.

And because the product's promise is *"your data never leaves your device"*, the interface does something most sites can't: **it shows its work**. The privacy claim is a live instrument (the *network ledger*), a real request log, and a button that tries to leak data so you can watch the browser refuse. The brand is the proof.

### One rule above all

> **Every decorative element must mean something.** If it carries no meaning, it doesn't ship.

| Device | What it means | Where it appears |
| --- | --- | --- |
| **Ledger rows** (numbered, ruled) | This is a catalogue; tools are catalogued parts | Home toolbox, `/tools`, category pages, related tools, favorites |
| **Ruler** (tick marks, "71 tools") | The catalogue has a measurable size | Under the hero, above the footer |
| **Crop marks + caption strip** | A tool is a printed plate with a part number | Every tool page, the hero bench, the request log |
| **Catalogue numbers** (`TOOL 027`) | Each tool has a stable identity | Tool plates, ledger on `/tools`, the ticket ("Tool 072 is yours to name") |
| **Highlighter marker** (lime) | "Look here": the active, selected or hovered thing | Headline phrase, hovered rows, active tabs, selection |
| **Hard offset shadow** | A thing you can press | Primary buttons, result slabs, the ticket |
| **Network ledger** | The privacy promise, measured | Hero bench, tool plates, footer |

## Principles

1. **The tool is the page.** Controls and results come first; explanation sits around them. A tool should do something useful the instant it loads (sample data, sensible defaults).
2. **Show your work.** Counts, sizes before/after, exact error positions, what was removed, what was sent (nothing).
3. **Craft over decoration.** Typography, spacing, alignment and rules do the work. No effects that exist only to look "modern".
4. **Calm and unmistakable.** One accent color, one highlight. Large type where it earns attention, quiet everywhere else.
5. **Accessible by default.** Contrast, labels, focus, keyboard and reduced motion are design inputs, not audits at the end. Tokens are tested against WCAG AA.
6. **Honest copy.** Plain, specific and a little dry. Say what a tool can't do.

## What we deliberately do not do

The first version of the site looked like a generic generated landing page. These are the patterns we removed and now reject. Most are enforced by `apps/web/tests/design-rules.test.ts`.

| We don't | Because | Instead |
| --- | --- | --- |
| Purple/indigo gradients, gradient headlines | The default "AI/SaaS" look; says nothing about us | Flat ink and paper, one green accent, a lime marker behind real words |
| Eyebrow pills above the headline ("Free · Open source · …") and status chips on tool pages | Decorative claims that nobody reads | The claim is *demonstrated*: the live network ledger, the proof section |
| Glow blobs, grid-fade backdrops, glassmorphism, blur | Atmosphere with no meaning | Paper grain at 3–5% opacity, hairline rules |
| A grid of identical rounded cards, each with a tinted icon square | Makes 71 different tools look like 71 identical ones | A numbered ledger with drawn glyphs; hover sweeps the marker |
| Soft drop shadows and big radii | Floaty, generic | 2–4px corners, flat surfaces, hard offset shadow only on pressable things |
| Centered hero with two buttons | Interchangeable with every other site | Asymmetric hero: display type left, a *working tool* right |
| Orange anywhere | House rule; also overused | Patina green + lime marker |
| Stock illustration, 3D blobs, emoji bullets | Template filler | Typography and small drawn glyphs on one grid |
| "Supercharge", "unlock", "seamless" | Empty filler | Say what it does |

## Color

Warm neutrals + one accent + one highlighter. Full values and contrast ratios are in [design-system.md](design-system.md).

- **Paper `#F4F0E6` / ink `#1B1A15`**: a warm off-white and a warm near-black instead of `#fff` / `#000`. They are easier on the eyes for long text and give the site its physical, printed character.
- **Patina green `#0B6B55`**: a verdigris, the color of aged copper tools. It carries actions, links and the focus ring. In dark mode it lifts to a luminous mint (`#46C9A3`).
- **Highlighter lime `#D8EC4E`**: the marker. It is *only ever a background behind ink text*, never text itself, and is identical in both themes so the brand mark never changes.
- **Status colors** (success green, warning dark-yellow, danger red) are reserved for status.
- **Never**: purple/indigo/violet (the generic-AI palette we left behind) or orange. Both are checked in tests.

Light paper is the **default for everyone**, regardless of OS setting, because it is the signature look. Dark "ink" and "match my system" are one click away and remembered.

## Typography

| Role | Face | Why |
| --- | --- | --- |
| Display (headlines, ledger names, numerals) | **Bricolage Grotesque**, heavy, tight tracking, optical sizing | A characterful grotesque with ink-trap details; has the "made by hand" quality without being decorative |
| Body and UI | **Instrument Sans** | Clear at 14–16px in dense tool interfaces |
| Data, labels, results | **Geist Mono** | Honest monospace for code, results and the small uppercase *label plates* |

All three are self-hosted (the Content Security Policy forbids third-party fonts, which is itself on-brand). Headlines are large and confident; labels are tiny and mono. The contrast in scale between the two is the hierarchy.

## Voice and copy

Plain, specific, a little dry. Short sentences. Verbs over adjectives.

| Instead of | Write |
| --- | --- |
| "Supercharge your workflow with our powerful, seamless tools" | "71 everyday tools for PDFs, images, code and text." |
| "100% secure and private!" | "Nothing is uploaded. Here is how to check." |
| "Successfully optimized!" | "1.2 MB → 340 KB (−72%)" |
| "Oops! Something went wrong" | "Page 9 is out of range (this PDF has 6 pages)." |
| "Get started free" | "Open the toolbox" |

Rules: sentence case; no exclamation marks except in a literal error caused by the user's data; numbers over adjectives; say what a tool *can't* do; never overstate security (ciphers say they are not secure; the privacy page lists the limits of the claim).

Naming is playful only where it stays clear: **the toolbox** (popular tools), **drawers** (categories), **the bench** (the live demo), **the plate** (a tool's frame), **the ledger** (any list of tools).

## Logo

A flat square of ink with the notch and bolt hole of an **open-end spanner head**, underlined by a **highlighter stroke**. The wordmark is Bricolage Grotesque ExtraBold. The mark takes its colors from the theme (ink on paper, paper on ink) while the underline stays lime in both. Favicon, app icons and Open Graph images use the same drawing on paper.

Do not: add a gradient, outline or shadow; recolor the underline; stretch it; place it on a busy background.

## Motion

Purposeful and short. The hero headline lines **rise** with a 70ms stagger and the marker **swipes** across like a pen; ledger rows sweep the marker on hover; the network-ledger digit **ticks** when it changes. Everything is CSS, nothing loops, and `prefers-reduced-motion` removes it all. No scroll-jacking, parallax or auto-playing animation.

## Imagery and glyphs

No photography or illustration. Tools are identified by small **specimen glyphs**: drawings on a 32px grid with one 1.75px square-capped stroke so they read as a set (merge-pdf shows two sheets feeding one, qr-code-generator shows finder squares, and so on). Tools without a custom specimen use their lucide icon in the same frame. See `apps/web/src/components/tool-glyph.tsx`.

## Accessibility is part of the look

- Text pairs are tested at ≥ 4.5:1 and borders/focus rings at ≥ 3:1, in both themes.
- Form controls have a visible ink border; focus is a 3px ring offset by 2px; forced-colors mode uses the system highlight.
- The marker is always paired with ink text (never light text on lime).
- Minimum 40px control height; 44px+ targets in the mobile menu.
- Scrollable regions are keyboard focusable and labelled; decorative marks (crop marks, ruler, glyphs) are hidden from assistive tech.

## Designing a new tool page

A tool's *page* is generated for you; you design only the tool inside the plate. Use the shared primitives so it matches without effort.

1. **Start from the job.** What does someone paste or drop in, and what do they want back? Make that the most prominent thing.
2. **Use `TransformTool` or the primitives.** `Field`, `Select`, `Toggle`, `SegmentedControl`, `Panel`, `Stat`/`StatGrid`, `ResultSlab`, `CopyButton`, `DownloadButton`, `FileDropzone`.
3. **Lead with the answer.** For calculators and converters, put the headline number in a `ResultSlab` and the detail in a `StatGrid` or table below.
4. **Labels are sentences; plates are mono.** Form labels are sentence case; mono uppercase is for metadata (`label-plate`), table heads and units.
5. **Colors come from tokens.** `bg-card`, `text-muted-foreground`, `border-border`, `text-primary`. Use `bg-marker text-marker-foreground` for a highlighted state. Never raw hex, never a gradient.
6. **Status is a left bar, not a tint.** Use `Alert` and `Badge`.
7. **Sample data and defaults** so the tool is alive on load; **honest limits** in the copy.
8. **Check it**: keyboard-only, 360px wide, light and dark, 200% zoom, `prefers-reduced-motion`.

## Colophon

Set in Bricolage Grotesque, Instrument Sans and Geist Mono, on paper the color of `#F4F0E6`. (The footer used to say so; it now credits the maintainer instead.)

## Decision log

| Decision | Reasoning |
| --- | --- |
| Light paper is the default regardless of OS | It is the signature look; dark is a first-class alternative, not the fallback |
| Hard shadows in dark mode use a lighter ledge (`#4A463A`) rather than black | A black shadow is invisible on near-black; the ledge keeps the press affordance |
| The ledger replaces cards everywhere | Rows scale to 71 items, scan faster, and make the catalogue feel like a catalogue |
| Marker, not a color fill, marks "active" | One recognisable gesture used for selection, hover and emphasis |
| The network ledger shows "…" until measured | The server must never claim a number the browser has not measured |
| The leak demo targets `example.com` | A real cross-origin POST is the honest test; the refusal comes from the CSP, not from us |
| No illustration set | A drawn-glyph system costs less, ages better and stays consistent |
