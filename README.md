# Toolwright

**Free, open-source tools that never see your data.**

Toolwright is a collection of 110 everyday online tools — format JSON, merge PDFs, compress images, generate passwords, decode JWTs, and more — where **every tool runs entirely in your browser**. Nothing you type or drop in is uploaded, there are no accounts, and a strict Content Security Policy means a page physically cannot send your input to a third party.

[Browse the tools](docs/tools.md) · [How privacy works](docs/privacy-model.md) · [Design language](docs/design-language.md) · [Contribute](CONTRIBUTING.md)

![The Toolwright home page: a display headline on a lime marker, a live working bench and a ruler](docs/images/home-light.png)

<p>
  <img src="docs/images/tool-json.png" alt="A tool page: the plate with caption strip, crop marks and a live network ledger" width="49%">
  <img src="docs/images/home-dark.png" alt="The home page in the dark ink theme" width="49%">
</p>

## Why

Most "free online tools" quietly upload your files to a server, wrap them in ads or trials, and tell you to trust them. Modern browsers are powerful enough to do the work locally, so Toolwright does — and makes that **verifiable** instead of just promised.

- **Private by construction.** Tools run client-side. A Content Security Policy (`connect-src 'self'`) enforces it, and end-to-end tests fail if a tool makes an outside request or transmits its input.
- **Free without catches.** No sign-up, watermarks, file-size limits or daily quotas.
- **Open source (MIT).** Read the code, fix a bug, or add the tool you wish existed. Each tool is one folder.
- **Accessible and fast.** Keyboard friendly, screen-reader labelled, light and dark themes, WCAG A/AA audited in CI, installable as an app, and usable offline once opened.

## How it looks

Toolwright looks like **a tool catalogue kept by a careful workshop**: warm paper and ink, a patina-green accent, a highlighter-lime marker, numbered ledger rows instead of card grids, and a live *network ledger* that counts the requests your browser made to other sites (it should read 0). No gradients, glows or pill badges, by rule and by test. The reasoning is in [docs/design-language.md](docs/design-language.md); tokens and components are in [docs/design-system.md](docs/design-system.md).

## What's inside

| Category | Examples |
| --- | --- |
| **Developer** | JSON formatter & validator, JWT decoder, regex tester, cron explainer, SQL formatter, timestamp converter, JSON → TypeScript, XML formatter & XML ↔ JSON, IP & subnet calculator (IPv4 and IPv6) |
| **PDF** | Merge, split, rotate, extract/delete pages, images → PDF, PDF → images, PDF → text, page numbers, watermark, metadata editor |
| **Image** | Compressor, converter, resizer, crop / rotate / flip, EXIF remover & viewer, SVG → PNG, image → Base64, color picker, image → SVG tracing, animated GIF maker & editor |
| **SVG** | Optimizer (SVGO), editor with live preview, sanitizer, data URI, SVG → React/TSX, path tools, recolor, blob/wave/polygon/star generator |
| **Text** | Word counter, diff checker, case converter, find & replace, sort/dedupe lines, Markdown preview |
| **Encoders & hashes** | Base64, URL & HTML encoding, hash generator (MD5/SHA/HMAC), hex/binary, string escaping |
| **Color & design** | Color converter, WCAG contrast checker, palette generator, QR codes (static, never expire) |
| **Generators** | Passwords & passphrases, UUID v4/v7, ULID, NanoID, lorem ipsum, barcodes (Code 128, EAN, UPC, Code 39, ITF) |
| **Calculators** | Units, percentages, dates, time zones, loans, compound interest, number bases |

See the [full catalogue](docs/tools.md). Missing something? [Request it](#request-a-tool) or build it.

## Getting started

Requirements: **Node.js 20+** and **npm 10+**.

```bash
git clone https://github.com/RaydanAridiCS/toolwright.git
cd toolwright
npm install
npm run dev          # http://localhost:3000
```

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:coverage` | Same, with a coverage report |
| `npm run e2e` | End-to-end tests (Playwright, runs against a production build) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm run new-tool <slug>` | Scaffold a new tool |
| `npm run docs:tools` | Regenerate [docs/tools.md](docs/tools.md) |
| `npm run screenshots` | Regenerate the images in `docs/images` (needs a running production server) |
| `npm run e2e:visual` | Optional visual snapshots (per-OS baselines, not run in CI) |
| `npm run db:generate` | Generate a SQL migration after changing the database schema |

First time running the end-to-end tests? Install the browser once: `npx playwright install chromium`.

## Project layout

```
apps/web/             Next.js app (App Router): pages, SEO, layout, command palette, PWA, API routes
packages/core/        Pure TypeScript logic for every tool. No React, no DOM, no network. Heavily unit-tested.
packages/ui/          Shared UI kit and the TransformTool building block
packages/tools/       One folder per tool: meta.ts (what the site needs) + Tool.tsx (the UI)
packages/db/          Drizzle schema, repositories and service for the tool-request board
scripts/              Registry generator, new-tool scaffold, docs generator
e2e/                  Playwright tests: privacy guarantees, real file workflows, accessibility, offline
docs/                 Architecture, design language, guides and reference (docs/images holds the screenshots)
```

Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Adding a tool

```bash
npm run new-tool my-tool-name -- --name "My Tool" --category developer
```

This scaffolds the metadata, UI, logic and tests, and registers the tool. Then follow [docs/writing-a-tool.md](docs/writing-a-tool.md). For simple text-in/text-out tools the whole UI is about 20 lines.

## Request a tool

Use the [request board](https://toolwright.com/requests) on the site to suggest and vote on ideas — no account needed.

## Privacy model in one paragraph

Tools do their work in your browser. The site sets `Content-Security-Policy: connect-src 'self'`, so page code cannot reach any other origin. Optional share links keep your input in the URL *fragment* (after `#`), which browsers never send to servers. The only data that reaches the server is what you deliberately submit to the request board (an idea you typed plus a one-way hash of an anonymous browser code). Details and a 60-second way to verify it yourself are in [docs/privacy-model.md](docs/privacy-model.md).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Bricolage Grotesque, Instrument Sans and Geist Mono (self-hosted) · Drizzle ORM + Postgres (request board only) · Vitest + Testing Library · Playwright + axe-core · npm workspaces

## Contributing

Contributions of every size are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Toolwright contributors
