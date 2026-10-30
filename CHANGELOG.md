# Changelog

All notable changes to Toolwright. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed: the "Workshop Ledger" redesign

The first version looked like a generic generated landing page. The whole interface was redesigned around one idea: a tool catalogue kept by a careful workshop. Read [docs/design-language.md](docs/design-language.md) for the why and [docs/design-system.md](docs/design-system.md) for the how.

- **Removed** the indigo/purple gradients, gradient headline, glow blobs, grid-fade backdrop, glass header, eyebrow pill above the headline, status chips on tool pages and the uniform grid of rounded cards with tinted icon squares.
- **New identity**: warm paper and ink, patina-green accent, highlighter-lime marker; Bricolage Grotesque, Instrument Sans and Geist Mono (self-hosted); sharp 2–4px corners; flat surfaces with hard offset shadows only on pressable things; paper grain at 3–5% opacity.
- **Light paper is now the default theme** for everyone; the toggle cycles Light → Dark → System. Dark "ink" has its own visible hard-shadow color.
- **New home page**: asymmetric hero ("Do the job. Keep the data.") with a *working* bench (JSON, Base64, Hash, Case run the real core functions), a ruler, the toolbox as a numbered ledger with drawn glyphs, drawers (categories), a proof section with a live request log and a "Try to make it leak" button, and a ticket that carries an idea to the request board.
- **Network ledger**: tool pages, the hero and the footer show how many requests this page made to other origins, measured in the browser with Resource Timing (see [docs/privacy-model.md](docs/privacy-model.md) for what it does and does not prove).
- **Catalogue, categories and tool pages** use ledger rows, a category rail, mono breadcrumbs, the *Plate* (crop marks, caption strip, status line), numbered how-to steps and a ruled FAQ.
- **New brand assets**: logo mark (spanner head with a marker underline), favicon, app icons, manifest colors and Open Graph images.
- **Shared primitives restyled** (so all 71 tools follow): `Button`, `Field` controls, `Toggle`, `SegmentedControl`, `Badge`, `Alert`, `Stat`/`StatGrid`, `Panel`, `FileDropzone`, `Kbd`. New: `Plate`, `StatusLine`, `ResultSlab`.
- **Tools sweep**: tinted result boxes replaced by `ResultSlab` (loan, compound interest, tip, unit converter, cron); error, status and checker backgrounds restyled; default sample colors use the brand palette.
- Full-screen numbered mobile menu; command palette restyled with a marker selection; no horizontal scroll at 360px.

### Added

- Five tools from the roadmap, bringing the catalogue to 76:
  - **JSON Diff** compares two JSON documents by structure and lists added, removed and changed paths, with an option to ignore array order.
  - **cURL to Fetch Converter** turns a copied cURL command into `fetch` code and notes any option fetch cannot reproduce. It keeps the command out of shareable links because commands often contain tokens.
  - **JSON Schema Generator** infers a schema from a sample, merging list items so keys missing from some become optional.
  - **PDF Page Organizer** reorders, turns, duplicates and removes pages from one list, and can collate a double-sided scan.
  - **Favicon Generator** makes `favicon.ico`, PNG icons for browsers, iOS and Android, a web app manifest and the HTML tags, as one ZIP.
- Five more tools, bringing the catalogue to 81:
  - **JSONPath Tester** runs a JSONPath query (filters, slices, wildcards, recursive search) against pasted JSON and lists each match with its path. Queries are parsed, never evaluated as code.
  - **HTML to Markdown Converter** turns pasted HTML into GitHub-flavoured Markdown with headings, lists, links, code blocks and tables. Scripts, styles and `javascript:` links are dropped.
  - **HTTP Header Explainer** explains request or response headers in plain English, breaks down cache, cookie, HSTS and CSP values, and adds a security checklist. It keeps pasted headers out of shareable links because they often hold cookies and tokens.
  - **Mortgage Affordability Calculator** finds the highest home price that fits the 28/36 lender rules, with a monthly breakdown that includes tax, insurance, dues and mortgage insurance.
  - **Salary and Hourly Pay Converter** converts pay between hourly, daily, weekly, every two weeks, twice a month, monthly, quarterly and yearly for a custom work schedule.
- **Compress PDF** brings the catalogue to 82. It is the first tool that changes a PDF's size in a meaningful way, and it has two modes:
  - **Keep text** recompresses the JPEG photos inside the PDF (quality and maximum resolution from Light, Balanced and Strong presets or custom values) and leaves text, links, forms and bookmarks alone. It runs in a Web Worker. Images it cannot handle (lossless, black-and-white scans, JPEG 2000, CMYK) are listed by reason instead of being skipped silently.
  - **Smallest file** draws every page with PDF.js and rebuilds the PDF from JPEGs, after a warning that selectable text, links, forms and bookmarks are lost.
  - A result is only offered when it is smaller than the original (at least 10% smaller for Smallest file); otherwise the original is offered. Files over 200 MB, and over 1,000 pages for Smallest file, are refused with a pointer to Split PDF. Progress and a Cancel button are shown for every run.
  - PDF.js (`pdfjs-dist` 6.4.299, which needs Node 22.13 or newer to install without a warning) is loaded only when Smallest file starts. Its worker, fonts and character maps are served from this site (`scripts/copy-pdfjs-assets.mjs` copies them into `apps/web/public/pdfjs/` before `dev` and `build`), so the Content Security Policy is unchanged. WebAssembly stays off because the policy has no `'wasm-unsafe-eval'`; PDF.js falls back to its JavaScript decoders.
  - New: `packages/core/src/pdf-compress.ts` with real PDF fixtures in `packages/core/tests/fixtures/pdf/` (made by `scripts/make-pdf-fixtures.mjs`), `RunProgress` in the shared PDF UI, a test that keeps PDF.js out of every other bundle, and the service worker now caches `/pdfjs/` files for offline use.
- **Page previews in the PDF Page Organizer.** Every row now shows a picture of its page instead of a generic icon, and the picture turns when you turn the page. PDF.js is loaded only after a file is dropped, previews are drawn one at a time and only for rows that scroll into view (a 300-page file draws a few dozen), and everything is released when the file is removed. If a page cannot be drawn the row keeps its icon and the tool works as before. The renderer is shared with Compress PDF (`packages/tools/src/shared/pdf-raster.ts`).
- Dockerfile (multi-stage, optional standalone output, `migrate` target) for maintainers; documented only in [docs/maintainers.md](docs/maintainers.md).
- `docs/design-language.md`, a rewritten `docs/design-system.md`, `docs/images/` screenshots and `npm run screenshots`.
- Design guardrails as tests: `apps/web/tests/design-rules.test.ts` (no gradients, glows, blur, pills, purple or orange, marketing filler) and `tokens.test.ts` (WCAG AA for every text pair in both themes).
- Optional visual snapshots: `npm run e2e:visual` (per-OS baselines, excluded from CI).
- Design checklist in `CONTRIBUTING.md` and the pull request template.

## [0.1.0]

First version: 71 browser-only tools across Developer, PDF, Image, Text, Encoders & hashes, Color & design, Generators and Calculators; command palette; favorites and recents; installable and offline-capable; strict CSP with end-to-end privacy tests; WCAG A/AA audits; request board with an in-memory or Postgres (Drizzle) store.
