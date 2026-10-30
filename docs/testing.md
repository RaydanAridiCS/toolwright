# Testing

Toolwright's promise is about trust, so the test suite is part of the product. It has four layers; each answers a different question.

| Layer | Tool | Question it answers | Location |
| --- | --- | --- | --- |
| Logic | Vitest (Node) | Is every function correct, including edge cases and bad input? | `packages/core/tests` |
| Data | Vitest + PGlite | Do both repository implementations satisfy the same contract, on a real Postgres engine? | `packages/db/tests` |
| UI | Vitest + Testing Library (jsdom) | Do components behave, does every tool mount, is the registry consistent? | `packages/ui/tests`, `packages/tools/tests`, `apps/web/tests` |
| End to end | Playwright + axe | Does the *built site* keep its privacy promise, work with real files, stay accessible and work offline? | `e2e/` |

## Running tests

```bash
npm test                  # all unit/component tests once
npm run test:watch        # watch mode
npm run test:coverage     # with a V8 coverage report (text summary + html in ./coverage)
npx vitest run --project core               # one project: core | db | ui
npx vitest run packages/core/tests/hash.test.ts   # one file
npx vitest run -t "md5"                     # by test name

npx playwright install chromium             # once
npm run e2e                                 # builds the site, starts it, runs all specs
npx playwright test e2e/privacy.spec.ts     # one spec
npx playwright test --ui                    # interactive runner
npx playwright show-report                  # open the last HTML report
E2E_BASE_URL=http://localhost:3000 npm run e2e   # test an already-running server
```

The e2e suite runs against the **production build** (`next build && next start`) because that is what users get: the real security headers, the service worker and static rendering.

## Layer 1: logic tests (`packages/core/tests`)

These are the most numerous and the cheapest. Principles:

- **Use authoritative vectors.** RFC test vectors for MD5/SHA/HMAC/Base64/CRC-32, the jwt.io sample token, published amortization figures, WCAG contrast ratios, etc. If a standard has test vectors, use them.
- **Test the boundaries.** MD5's 55/56/64-byte padding boundaries, UTF-8 and emoji, empty input, leap days, DST transitions, month-end clamping.
- **Test failure.** Every function that can throw has a test for the message users will see.
- **Make randomness deterministic.** Inject a fake random source; also test statistical properties (e.g. every character class appears, no modulo bias).
- **Round-trip properties.** `decode(encode(x)) === x` over many values; `fromRoman(toRoman(n)) === n`; converting every unit to every other and back.
- **Binary fixtures are built in the test.** The image-metadata and PDF tests construct minimal JPEG/PNG/WebP files and PDFs programmatically, so there are no binary blobs in the repo.
- **GIF fixtures come from a different encoder.** `scripts/make-gif-fixtures.mjs` (sharp/libvips) writes the files in `packages/core/tests/fixtures/gif/`, so the decoder is checked against GIFs it did not produce. Run the script only to regenerate them.
- **Hostile and extreme inputs have tests.** The SVG sanitizer is tested with script, `on*` handlers, `foreignObject`, obfuscated `javascript:` links, external hrefs, CSS `@import`/`url()` and animation that targets `href` (`packages/tools/tests/svg-sanitize.test.ts`, run in jsdom). The XML reader is tested with 50,000-deep nesting and the optimizer with 4,000 elements (those two slow tests have explicit 60 s timeouts so a busy full run does not flake).
- **Generated code is compiled.** The SVG to React tests transpile the output with the TypeScript compiler, so invalid JSX or TSX fails.
- **`e2e/svg-gif.spec.ts`** drives the 11 SVG and GIF tools in the production build: workers under the real security policy, downloads (file name and first bytes: `PNG`, `GIF89a`, `PK`) and no request leaving the site. It uses `process.cwd()` for fixture paths, because Playwright loads specs as CommonJS and `import.meta` is not available.

## Layer 2: database tests (`packages/db/tests`)

`repository.test.ts` defines one **contract suite** (`describe.each`) that runs against both `InMemoryToolRequestRepository` and `DrizzleToolRequestRepository`. The Drizzle variant runs on [PGlite](https://pglite.dev), a real Postgres compiled to WASM, and applies the *generated SQL migrations*, so schema, constraints and queries are exercised for real, with no external database. Add new behaviour to the contract suite and both implementations must pass.

`service.test.ts` covers validation, duplicate handling, rate limiting (with an injected clock) and anonymous-identity hashing.

## Layer 3: UI tests

- `packages/ui/tests` — primitives and `TransformTool` (typing, async transforms, errors, options, share links, file input, generators); `design-primitives.test.tsx` covers `Plate`, `StatusLine`, `ResultSlab`, `Alert`, `Badge`, `Stat` and the marker states.
- `apps/web/tests/design-rules.test.ts` — the "no slop" scan: no gradients, blur or glow, gradient text, oversized radius, padded pills, purple/indigo/violet or orange, or marketing filler anywhere in source, and the home hero keeps its structure (no eyebrow chip above the headline).
- `apps/web/tests/tokens.test.ts` — parses `globals.css` and checks every text pair against WCAG AA in both themes (ink on marker ≥ 7:1, control borders and focus ring ≥ 3:1), warm paper, sharp radius and visible hard shadows.
- `apps/web/tests/home.test.tsx` — `HeroBench` lists the PDF and image tools, loads the real tool for a tab, keeps visited tabs mounted and links to the full page; `use-outside-requests` classifies same-origin, cross-origin and `data:`/`blob:` entries correctly and reports "…" before measuring.
- `packages/tools/tests/registry.test.ts` — every tool's metadata is well formed; slugs match folders; `related` links resolve; the generated registry is up to date; copy never mentions self-hosting; search ranks sensibly (every tool is findable by its own name).
- `packages/tools/tests/smoke.test.tsx` — **every tool mounts** without errors, plus behaviour tests for representative tools (calculators, formatters, chmod, reference tables).

Tips:

- Query by role/label (`getByRole`, `getByLabelText`) — the same way assistive tech does. If you can't, the UI probably needs a label.
- Use `waitFor`/`findBy*` rather than fixed sleeps; `TransformTool` debounces by ~120 ms.
- jsdom has no canvas or `File.text()` in some versions; code uses helpers (`readFileText`) with fallbacks, and canvas-heavy flows are covered in Playwright.

## Layer 4: end-to-end tests (`e2e/`)

| Spec | What it proves |
| --- | --- |
| `privacy.spec.ts` | CSP and security headers present; the browser **blocks** a real cross-origin `fetch`; visiting **all tools** makes zero third-party requests; typed canary text never appears in any request; the URL hash is never sent; no cookies are set. |
| `files.spec.ts` | Real browser workflows with downloads: merge/split/extract/delete/rotate/number/watermark PDFs, images → PDF, metadata stripping, image compress/resize/convert (+ZIP), lossless EXIF removal, with no uploads. |
| `tools.spec.ts` | Catalogue search/filter/deep links, SEO metadata and JSON-LD, shareable hash state restored in a second tab, clipboard, generators, calculators, QR downloads, favorites and recents. |
| `requests.spec.ts` | Request board end to end: submit, vote, un-vote, duplicates, validation, API errors, honeypot. |
| `a11y.spec.ts` | axe-core (WCAG 2.0/2.1 A + AA) on ~22 pages in **light and dark** themes, the command palette, focus visibility, reduced motion. |
| `responsive.spec.ts` | No horizontal scroll on key pages at desktop and phone widths; mobile menu; tap-target size. |
| `offline.spec.ts` | After a tool is opened, it keeps working with the network off; unvisited pages fall back to the offline page. |
| `visual.spec.ts` | Optional `@visual` snapshots (home, catalogue, two tools, request board, light and dark). Baselines are per-OS, so they are excluded from the default run and from CI: `npm run e2e:visual -- --update-snapshots`, then `npm run e2e:visual`. |
| `home.spec.ts` | Home page (headline, working bench, network ledger reads 0, "Try to make it leak" is blocked, no gradient/blur in computed styles), command palette (keyboard and pointer), theme switching, static pages, 404, sitemap/robots/manifest. |

Helpers in `e2e/helpers.ts`: `trackRequests(page)` records every request (to assert none leave the origin or contain a canary), `makePng(page)` builds a PNG in the browser, `appAlert(page)` selects app alerts while ignoring Next's route announcer.

### Writing a privacy-sensitive test

```ts
const tracker = trackRequests(page);
await page.goto("/tools/my-tool");
await page.getByLabel("Input").fill("CANARY-do-not-leak");
await page.waitForTimeout(700); // debounce + hash sync
expect(tracker.containing("CANARY-do-not-leak")).toEqual([]);
expect(tracker.external(baseURL!)).toEqual([]);
```

## Coverage

`npm run test:coverage` reports coverage for `packages/*/src` (generated files and barrel `index.ts` files excluded). Coverage is a tool for finding untested code, not a target to game — prefer a test that would catch a real bug over one that merely executes a line.

## When tests fail in CI

1. Reproduce locally with the same command CI uses (`npm run lint && npm run typecheck && npm run test:coverage`, then `npm run e2e`).
2. For e2e failures, download the `playwright-report` artifact from the run: it includes traces (`npx playwright show-trace trace.zip`) and screenshots.
3. "Generated registry is out of date": run `node scripts/gen-registry.mjs` (and `npm run docs:tools`) and commit the result.
