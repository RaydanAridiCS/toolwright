# Changelog

All notable changes to Toolwright. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed: the request board

- **A database outage no longer looks like a bug.** On the live site `GET /api/requests` answered `500 Something went wrong on our side` and the board gave visitors no way forward. A database that cannot be reached, refuses the login or has no tables now gives `503` with `Retry-After: 60` and the code `unavailable`; the board shows "The board is taking a break" with a *Try again* button, and nothing a visitor typed is lost. The app also stops waiting for an unreachable database after 10 seconds.
- **The home page ticket now does what its button says.** "Add to the board" used to open the request page with the text prefilled, which read as a failed submit. It now sends a real idea to the board and confirms it in place; a duplicate, a rate limit or an outage keeps the typed text and links to the board.
- **Status filter** on the board (All, Open, Planned, In progress, Shipped) and a link to the contribution guide for anyone who wants to build an idea.

### Added: deploy checks and link previews

- **`GET /api/health`** reports whether the server is up and whether the board's database answers (`ok`, `unreachable`, `rejected`, `not_migrated` or `error`), with no connection string or error text. 200 when healthy, 503 otherwise.
- **`npm run check:deploy`** (`scripts/check-deploy.mjs`) reads a live site and prints PASS, WARN or FAIL with a fix for each: HTTPS and the http redirect, the `www` redirect, the security headers, injected scripts, service-worker caching, `robots.txt`, the sitemap, `llms.txt`, the social card, a WhatsApp-style request, the database and the IndexNow key. Read-only; exits 1 on a failure.
- **A go-live checklist** in [docs/maintainers.md](docs/maintainers.md), a database troubleshooting table, Cloudflare settings to review, and `.env.example` now lists `TOOLWRIGHT_AI_TRAINING` and the SSL note for `DATABASE_URL`.
- **A social card for every page.** Guides, categories, `/tools`, `/requests`, `/about`, `/privacy` and `/contribute` had shared the home card (captioned "TOOL CATALOGUE"); each now has its own. Image tags gained `og:image:type` and `secure_url`, guides are `og:type` article with their real dates, and the article structured data points at the guide's own card. Details in [docs/seo.md](docs/seo.md#link-previews-whatsapp-facebook-linkedin-x-telegram-slack-discord).
- **Tests:** `packages/db/tests/health.test.ts`, `apps/web/tests/health.test.ts`, `check-deploy.test.ts`, ticket and board cases in `home.test.tsx` and `request-board.test.tsx`, and in `e2e/seo.spec.ts` a check that every sitemap page has a card that resolves as a 1200x630 PNG under 300 KB and that WhatsApp, Facebook, X, LinkedIn, Telegram, Slack and Discord requests get the tags in the head.

### Added: search and answer-engine optimisation

Details and rationale in [docs/seo.md](docs/seo.md). Nothing here adds analytics, a third-party script or a network call from a tool.

- **Search copy for all 110 tools** (new optional `ToolMeta` fields, each with tests): `primaryKeyword` (unique), `seoTitle` (25-47 characters, no brand; the full title is 60 or fewer), `seoDescription` (110-160), `answer` (an answer-first first paragraph) and `nextStep`. Every tool now has a FAQ and at least three steps (58 gained a FAQ, 65 gained steps).
- **Keyword and intent map** (`packages/tools/src/seo/keyword-map.ts`, generated [docs/keyword-map.md](docs/keyword-map.md), `npm run docs:seo`). Volume and difficulty are marked as estimates.
- **Category landing pages** have their own H1, title, description and a 100-200 word introduction.
- **Guides** (`/guides`, 7 guides): compress a PDF without uploading it, reduce a PDF under 1 MB, merge PDFs without uploading, what EXIF data is, JPG vs PNG vs WebP, how to tell whether a tool uploads your files, and CIDR notation. Each has a byline, true dates, an FAQ and Article markup.
- **Structured data** moved into `lib/structured-data.ts` and extended: WebApplication with `featureList` and an inline publisher, Organization and WebSite (with a working SearchAction) on the home page, ItemList for the catalogue and categories, BreadcrumbList everywhere, Article for guides. A visible FAQ on the home page.
- **`/llms.txt` and `/llms-full.txt`**, generated from the registry.
- **`robots.txt` policy** for search and answer crawlers (always allowed) and AI training crawlers (allowed by default, `TOOLWRIGHT_AI_TRAINING=block` turns them off).
- **Sitemap** with real `lastmod` dates (`scripts/gen-lastmod.mjs`) instead of the build time, and no `priority` or `changefreq`; guides added (133 URLs).
- **`www` to apex redirect** (308), `X-Robots-Tag: noindex` on the API and the offline page, a one-day cache for the PDF.js files, a default social card, per-page titles, descriptions and social cards (the home page and static pages used to share the home page's), and per-tool image alt text.
- **`scripts/indexnow.mjs`** for submitting changed URLs to Bing and other IndexNow engines from your own machine.
- **Tests:** `packages/tools/tests/seo.test.ts`, `keyword-map.test.ts`, `apps/web/tests/seo.test.ts`, `indexnow.test.ts` and `e2e/seo.spec.ts` (raw HTML, no JavaScript).

### Changed: search

- Titles read `<keyword page title> | Toolwright` instead of `<name>: Free & Private Online Tool · Toolwright`.
- `/tools` renders the whole catalogue on the server (it used to have no tool links in its HTML) and no longer shifts when the interactive catalogue loads (layout shift 0.396 to 0).
- The "Also searched as" keyword list is gone from tool pages; `keywords` now only feeds the in-site search.
- The Geist Mono font is preloaded: a late swap re-wrapped the breadcrumb and moved the page (layout shift about 0.14 to 0 on two tools).
- Compress PDF is now one of the featured tools on the home page; the home toolbox shows 14 tools.
- The home page description no longer says "70+ tools"; the README no longer claims there are no file-size limits (a few tools cap size, and say so).

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
- Six more tools, bringing the catalogue to 110. All run in the browser, and every picture, PDF and file stays on the device:
  - **Crop, Rotate & Flip Image** crops a JPG, PNG or WebP with a draggable box (or typed left, top, width and height, or the arrow keys), free or at a fixed shape (1:1, 4:3, 3:2, 16:9 and more, or your own), turns it in quarter steps, flips it, and straightens a crooked photo by up to 45 degrees with a one-click "remove empty corners". A photo's EXIF turn is honoured and its camera and location data is not copied to the new file.
  - **PDF to Images** draws the pages you choose (or all of them) as PNG, JPG or WebP at 72 to 300 DPI, page by page with progress and a Cancel button, and saves them one at a time or as one ZIP. Very large pages are drawn a little smaller instead of failing, and a run stops with what is finished if the pictures pass 400 MB.
  - **PDF to Text** reads the text layer of a PDF and rebuilds lines, paragraphs and words split by a hyphen from the position of each piece of text. It marks pages if you ask, and says plainly when a PDF is a scan (there is no OCR).
  - **XML Formatter & Converter** checks XML with the line and column of the first problem, formats it (2 or 4 spaces, or tabs), shrinks it, and converts it to JSON and back. Entities from a DOCTYPE are never expanded and nothing external is loaded, so "billion laughs" files are harmless. Text, entities and CDATA keep their original spelling, and mixed content is left alone.
  - **IP & Subnet Calculator** works with IPv4 and IPv6: a network's netmask, wildcard, range and host count, splitting by prefix, subnet count or hosts needed, an address range turned into the fewest CIDR blocks, "is this address in that network", and merging a list of addresses, blocks and ranges. Leading zeros such as `010.0.0.1` are refused because systems disagree about them.
  - **Barcode Generator** makes Code 128, EAN-13, UPC-A, EAN-8, Code 39, Interleaved 2 of 5 and ITF-14 as SVG or PNG, adds or checks the check digit, and warns about colours that would not scan.
  - New core modules (no DOM): `image-crop`, `pdf-to-images`, `pdf-to-text`, `xml-formatter`, `subnet-calculator` and `barcode-generator`. `shared/pdf-raster.ts` (still the only file that mentions PDF.js) gained `renderPagesToImages` and `extractPdfText`, and `shared/image-crop-render.ts` does the canvas drawing for the crop tool. No new dependencies and no new workers.
  - New end-to-end spec `e2e/more-tools.spec.ts`, and all six pages are in the accessibility scan.
- Dockerfile (multi-stage, optional standalone output, `migrate` target) for maintainers; documented only in [docs/maintainers.md](docs/maintainers.md).
- `docs/design-language.md`, a rewritten `docs/design-system.md`, `docs/images/` screenshots and `npm run screenshots`.
- Design guardrails as tests: `apps/web/tests/design-rules.test.ts` (no gradients, glows, blur, pills, purple or orange, marketing filler) and `tokens.test.ts` (WCAG AA for every text pair in both themes).
- Optional visual snapshots: `npm run e2e:visual` (per-OS baselines, excluded from CI).
- Design checklist in `CONTRIBUTING.md` and the pull request template.

## [0.1.0]

First version: 71 browser-only tools across Developer, PDF, Image, Text, Encoders & hashes, Color & design, Generators and Calculators; command palette; favorites and recents; installable and offline-capable; strict CSP with end-to-end privacy tests; WCAG A/AA audits; request board with an in-memory or Postgres (Drizzle) store.
