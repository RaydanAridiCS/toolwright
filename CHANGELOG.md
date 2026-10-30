# Changelog

All notable changes to Toolwright. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- The footer line about fonts and paper colour is replaced by "Developed and maintained by raydan.dev".
- The public repository is now https://github.com/RaydanAridiCS/toolwright (site links, README, CONTRIBUTING, Dockerfile, `.env.example`, issue template).

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
- **The home page bench now runs the real tools.** The four text demos (JSON, Base64, Hash, Case) are replaced by tabs for Merge PDF (the default), Compress PDF, Organize pages, Images to PDF and Compress images. Each tab is the same component as the full tool page, loaded after the page is idle and only for tabs you open, with the network counter underneath. Using the bench does not touch the address bar or the "recently used" list.
- Ten more tools, bringing the catalogue to 92:
  - **Fetch to cURL Converter** turns a `fetch(...)` call into a cURL command (headers, JSON, `URLSearchParams`, `FormData`, `new Request`). The code is read as text and never evaluated, variables are kept as `${name}` with a note, and it keeps pasted code out of shareable links. Round-trip tests run its output back through the cURL parser.
  - **JSON Merge (Three-Way)** merges two edited JSON files with the original they came from, like `git merge`: key order is kept, conflicts are listed with JSONPath-style paths, and arrays can be treated as one value, as a set, or matched by an ID property.
  - **GraphQL Formatter** formats and minifies queries, mutations, fragments and schema definitions, with line-numbered errors. Tests check it is idempotent and loses no tokens.
  - **Dockerfile Linter** reports about 30 common problems with a line number and a fix for each (unpinned images, running as root, `apt-get` without `-y`, `curl | sh`, secrets in `ENV`, bad `COPY` destinations and stage names).
  - **YAML Validator and Linter** gives the line and column of an error and flags traps such as unquoted `yes`/`no`, leading-zero numbers and versions like `3.10`, with a size-capped JSON view.
  - **Readability Score Checker** computes Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau and ARI for English text, plus reading time and the hardest sentences. The formulas are tested against their published definitions; syllable counting is approximate and the tool says so.
  - **BMI Calculator** in metric or imperial units with the WHO adult scale, the healthy weight range, and plain notes on what BMI cannot tell you. It refuses ages under 18 and keeps health data out of the URL.
  - **Unit Price Comparison** ranks products by price per 100 g, litre, item or metre across metric and US units, including multipacks.
  - **Meeting Time Planner** finds the windows when everyone is inside working hours across time zones for a chosen day, using the platform's real daylight-saving data (tests cover the weeks when the US and Europe have changed clocks on different dates, and 23 and 25 hour days). Shareable link.
  - **Sign PDF** places a drawn, typed or uploaded signature on a page preview, with drag, resize and keyboard nudging, for one page, the last, all or a list, plus an optional date line. Positions are converted correctly for pages stored turned by 90, 180 or 270 degrees (tested by reading the output back). It warns that this is a picture, not a digital signature, and when a file already carries one.
- **Mermaid Diagram Editor** (catalogue: 93). Write Mermaid text and see flowcharts, sequence, class, state, ER, Gantt, pie, journey, git, mind map, timeline, quadrant, C4, XY, Sankey, block, architecture, packet, kanban and requirement diagrams. Choose a theme and background, download SVG or PNG (2x and 3x), copy the SVG, or share the diagram as a link. `mermaid` 12.2.0 is loaded only when the tool opens (about 640 KB gzipped, in many on-demand chunks; the home page and other tools never load it), in `securityLevel: "strict"` with plain SVG labels, and shown through an `<img>` so a diagram can never run script. A browser test draws every example and the rarer diagram types under the production Content Security Policy and tries script injection through labels and `click` links.
- Eleven SVG and GIF tools, bringing the catalogue to 104. All run in the browser, and every picture, SVG and GIF stays on the device:
  - **SVG Optimizer** shrinks one or many SVGs with SVGO (run in a Web Worker, fetched only when a file is added), with before/after pictures, a choice of decimals, options to keep ids and accessible text, and a ZIP of all results. A result that is not smaller is returned as it was.
  - **SVG Editor** has live preview on white, dark or transparent, format, auto-fix for a missing `xmlns` or `viewBox`, exact size from the viewBox, padding, and SVG or PNG export.
  - **SVG Sanitizer** removes scripts, event handlers, `foreignObject`, links to other sites, CSS `@import` and external `url()`, and animation that could set a `javascript:` link (DOMPurify plus SVG rules), then lists exactly what was taken out.
  - **SVG to Data URI**, **SVG to React** (JS or TSX, `currentColor`, `memo`, props), **SVG Path Tools** (absolute/relative, curves, reverse, move/scale/rotate, length and bounds), **SVG Recolor** (colour list, replace, invert, grayscale, lighten, darken, `currentColor`, undo), **SVG Shape Generator** (seeded blobs, waves, polygons, stars; SVG and PNG export) and **Image to SVG** (tracing in a worker, black and white or colour).
  - **GIF Maker** joins pictures into an animated GIF with reordering, fit/crop/stretch, delay, looping and colours. **GIF Editor** trims, drops frames, reverses, boomerangs, changes speed, rotates, flips, resizes and re-encodes with an optimize step, and can save every frame as PNG in a ZIP. GIF work runs in a worker and can be cancelled.
  - New core modules (no DOM): `svg-xml` (a small iterative XML reader and writer), `svg-optimize`, `svg-tools`, `svg-data-uri`, `svg-to-jsx`, `svg-path`, `svg-colors`, `svg-shapes`, `svg-report`, `gif-tools`, `image-trace`, with real GIF fixtures made by a different encoder (`scripts/make-gif-fixtures.mjs`). New dependencies, exact versions, all in `@toolwright/core`: `svgo`, `gifenc`, `omggif`, `imagetracerjs`. A test keeps each of them behind a single module that only workers load.
- Dockerfile (multi-stage, optional standalone output, `migrate` target) for maintainers; documented only in [docs/maintainers.md](docs/maintainers.md).
- `docs/design-language.md`, a rewritten `docs/design-system.md`, `docs/images/` screenshots and `npm run screenshots`.
- Design guardrails as tests: `apps/web/tests/design-rules.test.ts` (no gradients, glows, blur, pills, purple or orange, marketing filler) and `tokens.test.ts` (WCAG AA for every text pair in both themes).
- Optional visual snapshots: `npm run e2e:visual` (per-OS baselines, excluded from CI).
- Design checklist in `CONTRIBUTING.md` and the pull request template.

## [0.1.0]

First version: 71 browser-only tools across Developer, PDF, Image, Text, Encoders & hashes, Color & design, Generators and Calculators; command palette; favorites and recents; installable and offline-capable; strict CSP with end-to-end privacy tests; WCAG A/AA audits; request board with an in-memory or Postgres (Drizzle) store.
