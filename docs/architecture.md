# Architecture

Toolwright is a TypeScript monorepo managed with **npm workspaces**. This document explains how the pieces fit together so you can find your way around and make changes confidently.

```
┌──────────────────────────── apps/web (Next.js 16, App Router) ────────────────────────────┐
│  pages · layout · SEO · command palette · PWA · API routes (request board only)            │
└───────────────┬───────────────────────────┬───────────────────────────┬────────────────────┘
                │ renders                   │ renders                   │ calls
        ┌───────▼────────┐          ┌───────▼────────┐          ┌───────▼────────┐
        │ @toolwright/   │ uses     │ @toolwright/   │          │ @toolwright/db │
        │ tools          ├─────────►│ ui             │          │ Drizzle +      │
        │ meta.ts+Tool.tsx│         │ primitives +   │          │ repositories   │
        └───────┬────────┘          │ TransformTool  │          └────────────────┘
                │ calls             └────────────────┘
        ┌───────▼────────┐
        │ @toolwright/   │   pure TypeScript: no React, no DOM, no network
        │ core           │
        └────────────────┘
```

Dependencies only point **downwards**. `core` knows about nothing else, which is what makes its logic easy to test and reuse.

## Packages

### `packages/core` — the logic

Plain TypeScript modules, one per domain (`json.ts`, `pdf.ts`, `hash.ts`, `color.ts`…). Rules:

- **No React, no DOM, no network.** Functions take values and return values (or throw an `Error` with a human-readable message).
- Anything that needs the browser (canvas, files) lives in `packages/tools`; `core` works on bytes and strings so it runs in Node tests.
- Web Crypto (`crypto.subtle`, `crypto.getRandomValues`) is used for hashing and randomness; both exist in browsers and Node 20+.
- Each module is importable on its own (`@toolwright/core/hash`) so bundlers include only what a tool needs. `index.ts` re-exports everything as namespaces.

Notable modules: `pdf.ts` (pdf-lib), `image-meta.ts` (lossless EXIF/metadata stripping for JPEG/PNG/WebP by walking the file's binary structure), `json.ts` (a strict scanner that reports exact error positions on every engine), `cron.ts`, `time.ts` (Intl-based zones), `qr.ts` (SVG output and payload builders).

SVG and GIF modules (all pure, tested in Node): `svg-xml.ts` (a small iterative XML reader and writer that round-trips unformatted files byte for byte and survives 50,000-deep nesting), `svg-optimize.ts` (SVGO with the viewBox always kept), `svg-tools.ts` (info, checks, format, fix, size, viewBox), `svg-data-uri.ts`, `svg-to-jsx.ts`, `svg-path.ts` (path parser, absolute/relative, arcs to curves, transforms, reverse, bounds, length), `svg-colors.ts`, `svg-shapes.ts` (seeded blob, wave, polygon and star generators), `svg-report.ts` (what a cleaning removed), `gif-tools.ts` (decode, edit and encode animated GIFs as full-size RGBA frames) and `image-trace.ts` (imagetracerjs on raw pixels). The DOM-dependent part, `sanitizeSvg` (DOMPurify plus SVG rules), lives in `packages/tools/src/shared/svg-sanitize.ts`.

**Workers.** SVGO, GIF work and tracing run in Web Workers bundled with the page (`shared/svg-optimize.worker.ts`, `gif.worker.ts`, `image-trace.worker.ts`), each with a small client (`*-client.ts`) that starts the worker, passes progress and cancels by terminating it. The heavy libraries (`svgo`, `gifenc`, `omggif`, `imagetracerjs`) are imported by one core file each and, at run time, only by those workers; `packages/tools/tests/bundle-isolation.test.ts` enforces both. SVG previews (`shared/svg-preview.tsx`) draw through an `<img>` from a local blob so a hostile file cannot run script.

Image, PDF, XML, network and barcode modules (all pure, tested in Node): `image-crop.ts` (the geometry behind Crop, Rotate & Flip: whole-pixel boxes, dragging a handle while keeping a fixed shape, the canvas matrix for flips, quarter turns and straightening, and the largest upright box inside a tilted picture), `pdf-to-images.ts` (page selection, the per-page resolution plan with a pixel cap, file names and the memory budget), `pdf-to-text.ts` (turns the pieces of text PDF.js finds into lines, paragraphs and re-joined hyphenated words, and says when a PDF is a scan), `xml-formatter.ts` (an iterative XML reader that never expands DOCTYPE entities, a formatter and minifier that keep text exactly as written, and XML to JSON and back), `subnet-calculator.ts` (IPv4 and IPv6 as BigInt: networks, splitting, address ranges to CIDR blocks, merging) and `barcode-generator.ts` (Code 128 with a shortest-symbol search, EAN and UPC, Code 39, Interleaved 2 of 5, and the SVG writer). `pdf-to-images.ts` and `pdf-to-text.ts` do not touch PDF.js: `shared/pdf-raster.ts`, still the only file that names it, gained `renderPagesToImages` and `extractPdfText` and passes the results to them, and `shared/image-crop-render.ts` draws the crop on a canvas. These tools add no libraries and no new workers; PDF.js runs from the same worker file as before.

### `packages/ui` — the UI kit

Tailwind-styled, accessible primitives (`Button`, `Field`, `Select`, `Toggle`, `SegmentedControl`, `FileDropzone`, `CopyButton`, `ScrollArea`…) plus the Workshop Ledger primitives (`Plate`, `StatusLine`, `ResultSlab`, `Stat`/`StatGrid`, `Alert`, `Badge`; see [design-system.md](design-system.md)) and two building blocks:

- **`useShareableState`** mirrors component state into the URL *hash* (`#s=…`, base64url JSON). The fragment is never sent to a server, so shareable links don't weaken privacy.
- **`TransformTool`**: a config-driven "input → options → output" tool: textareas, sample data, paste, open file, copy, download, "use output as input", error display, debounced async transforms and share links. Roughly 60% of tools are a `TransformTool` plus a function from `core`.

### `packages/tools` — the tools

Each tool is a folder under `src/tools/<slug>/`:

| File | Role |
| --- | --- |
| `meta.ts` | Pure data (`defineTool({...})`): name, tagline, description, category, keywords, icon, optional `howTo`, `faq`, `related`. Safe to import on the server; drives routing, search, SEO and sitemap. |
| `Tool.tsx` | The UI (default export). Client component, loaded lazily. |

`meta.ts` also holds the search fields (`primaryKeyword`, `seoTitle`, `seoDescription`, `answer`, `nextStep`). The research behind them (secondary queries, intent, estimates) is `src/seo/keyword-map.ts`, the category landing copy is `src/seo/category-content.ts`, and `docs/keyword-map.md` is generated from the first (`npm run docs:seo`).

`scripts/gen-registry.mjs` scans the folders and writes two generated files (committed, and verified by a test):

- `registry.generated.ts` — the list of every tool's `meta`.
- `loaders.generated.ts` — `() => import("./tools/<slug>/Tool")` for each tool.

Splitting them means search, the sitemap and cards never pull tool UI code into their bundles; a tool's code downloads only when its page is opened. `src/index.ts` exposes `tools`, `getTool`, `toolsByCategory`, `relatedTools`, `popularTools` and a ranked `searchTools`.

`src/shared` holds helpers used by several tools: `image.ts` (canvas decode/encode with EXIF orientation), `zip.ts`, `pdf-ui.tsx` (drop zone + job state for PDF tools), `image-workbench.tsx` (shared by the compressor, converter and resizer), `reference-table.tsx`, `number-field.tsx`.

### `packages/db` — the request board

Used by exactly one feature. It follows the **repository pattern**:

- `repository.ts` defines the `ToolRequestRepository` interface and domain types.
- `drizzle-repository.ts` implements it for Postgres via Drizzle; `memory-repository.ts` implements it in memory. Both run the **same contract test suite** (the Postgres one against PGlite, a real in-process Postgres).
- `service.ts` holds the business rules (validation with Zod, anonymous identity by hashing a browser token, rate limiting, duplicate handling) so API routes stay thin.
- `client.ts` chooses the implementation: Postgres when `DATABASE_URL` is set, otherwise the in-memory store (seeded with examples) so development needs no setup.

See [request-board.md](request-board.md).

### `apps/web` — the site

Next.js App Router. Key points:

- **Static by default.** Home, catalogue, category and every tool page are prerendered (`generateStaticParams`). Only the `/api/requests` routes and `/api/health` (the database check used by `npm run check:deploy`) are dynamic; both are `noindex`, `no-store` and disallowed in `robots.txt`.
- **Tool pages** render server-side metadata, description, FAQ, JSON-LD and related tools. The interactive tool itself mounts on the client (`ToolLoader`), because tools read the URL hash, localStorage and other browser-only APIs. It is wrapped in a Suspense boundary and an error boundary (for a friendly message if a chunk can't load offline).
- **Security headers** (`next.config.ts`): a Content Security Policy that restricts connections to the site's own origin, plus `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and framing protection. See [privacy-model.md](privacy-model.md).
- **Design layer.** All tokens live in `app/globals.css` (light "paper" and dark "ink"; Tailwind's `--radius-*` and `--shadow-*` are remapped there, so every tool inherits sharp corners and flat, hard shadows). Fonts (Bricolage Grotesque, Instrument Sans, Geist Mono) are self-hosted through `next/font/local` in `layout.tsx`. The default theme is light for everyone; `THEME_INIT_SCRIPT` sets it before paint. Site components: `Ledger` (numbered rows that replace card grids), `ToolGlyph`, `Ruler`, `Logo`, and the home page's `HeroBench`, `ProofLog` and `Ticket`.
- **Network ledger.** `lib/use-outside-requests.ts` observes Resource Timing (`PerformanceObserver`, `buffered: true`) and `NetworkLedger` shows how many requests this page made to other origins. It shows "…" until measured, never a number the browser has not seen. What it proves and what it does not: see [privacy-model.md](privacy-model.md).
- **Command palette** (`cmdk`): `Ctrl/Cmd+K` or `/`, ranked by `searchTools`, with favorites and recents from `localStorage`.
- **PWA**: `public/sw.js` caches build assets and visited pages so opened tools work offline; `manifest.ts` and generated icons make it installable.
- **SEO and answer engines** (see [seo.md](seo.md)): `lib/seo.ts` builds every page's title, canonical URL and social card (`pageMetadata`); `lib/structured-data.ts` builds the JSON-LD (WebApplication, BreadcrumbList, FAQPage, HowTo, CollectionPage with an ItemList, Organization, WebSite, Article); `robots.ts` is generated from `lib/crawler-policy.ts`; `/llms.txt` and `/llms-full.txt` come from `lib/llms.ts`; `sitemap.ts` uses real dates from `scripts/gen-lastmod.mjs`; `content/guides.ts` holds the guides. Tool, category and guide pages put the title, answer, steps and FAQ in the static HTML, and `/tools` renders the whole catalogue on the server so a crawler that does not run JavaScript sees every link.

## Data flow for a typical tool

1. Visitor opens `/tools/json-formatter` → static HTML with the tool's description, FAQ and structured data.
2. `ToolLoader` mounts, lazily imports `tools/json-formatter/Tool.tsx` and records the visit in `localStorage` (recents).
3. `Tool.tsx` renders `TransformTool`. Typing updates state; after a short debounce the `transform` function (from `core`) runs **in the browser** and the output appears.
4. State is mirrored into `location.hash`. Nothing is sent over the network.

## Design decisions

| Decision | Why |
| --- | --- |
| Logic in `core`, UI in `tools` | Logic is testable in Node without a browser and reusable (for example as an npm package). |
| `meta.ts` separate from `Tool.tsx` | The server can list, search and index all tools without loading any tool UI. |
| Generated registry | Adding a tool never means editing a shared list — fewer merge conflicts, and a test guards against drift. |
| URL hash for shareable state | Keeps privacy intact (fragments aren't sent to servers) with no backend. |
| CSP instead of a promise | The browser enforces the privacy guarantee; tests verify it. |
| Tokens remapped, not rewritten | Re-pointing `--radius-*`, `--shadow-*` and the color tokens restyled 71 tools without touching them; the design rules are tested so new tools cannot drift. |
| In-memory fallback for the request board | A fresh clone works with `npm install && npm run dev` — no database needed. |
| No accounts | Less to secure, nothing personal to store. Votes use a random browser token that is hashed server-side. |

## Adding to the architecture

- New **domain logic** → `packages/core/src/<name>.ts` + tests.
- New **tool** → `npm run new-tool`. See [writing-a-tool.md](writing-a-tool.md).
- New **shared UI** → `packages/ui` (with a component test) if generic; `packages/tools/src/shared` if only tools use it.
- New **page** → `apps/web/src/app/...`, with metadata and an e2e or accessibility check.
