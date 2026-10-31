`# Writing a tool
`
`This guide takes you from an idea to a merged tool. If you only read one section, read [the checklist](#checklist).
`
`## 1. Scaffold
`
````bash
`npm run new-tool word-wrap -- --name "Word Wrap" --category text --icon WrapText
````
`
`| Flag | Default | Meaning |
`| --- | --- | --- |
`| `--name` | Title-cased slug | Display name |
`| `--category` | `developer` | One of `text`, `developer`, `data`, `encoding`, `image`, `pdf`, `design`, `generators`, `calculators` |
`| `--icon` | `Wrench` | Any [lucide-react](https://lucide.dev/icons) icon name |
`| `--template` | `transform` | `transform` (text in → text out) or `custom` (free-form UI) |
`| `--no-core` | off | Skip creating a logic module and test (only for pure-UI tools) |
`
`The slug becomes the URL (`/tools/word-wrap`), so choose it carefully: lowercase letters, digits and single hyphens, ideally what people would search for ("json-formatter", "merge-pdf").
`
`This creates:
`
````
`packages/tools/src/tools/word-wrap/meta.ts    metadata
`packages/tools/src/tools/word-wrap/Tool.tsx   UI
`packages/core/src/word-wrap.ts                logic
`packages/core/tests/word-wrap.test.ts         unit tests
````
`
`and regenerates the registry.
`
`## 2. Write the logic in `core`
`
````ts
`// packages/core/src/word-wrap.ts
`export function wordWrap(input: string, width: number): string {
`  if (!Number.isInteger(width) || width < 1) throw new RangeError("Width must be a whole number of 1 or more.");
`  // …
`}
````
`
`Guidelines:
`
`- **Pure and synchronous when possible.** Take inputs, return outputs. Use `async` only for Web Crypto or streams.
`- **Throw `Error`s with messages a non-developer can act on.** The UI shows `error.message` as-is: "Input is not valid Base64 (bad length)." beats "Invalid argument".
`- **Make randomness injectable** (`random: () => number` or `RandomBytes`) so tests are deterministic. Always use `crypto.getRandomValues` in production code for anything security-related; never `Math.random`.
`- **Handle the awkward inputs:** empty strings, unicode (emoji, combining marks), very long input, `\r\n` line endings.
`- **No React, DOM, `window`, `fetch` or `localStorage`.** If you need canvas or files, keep that in the tool's `Tool.tsx` or `packages/tools/src/shared` and pass bytes into `core`.
`
`## 3. Test it
`
````ts
`// packages/core/tests/word-wrap.test.ts
`import { describe, expect, it } from "vitest";
`import { wordWrap } from "../src/word-wrap";
`
`describe("wordWrap", () => {
`  it("wraps at the given width", () => {
`    expect(wordWrap("the quick brown fox", 10)).toBe("the quick\nbrown fox");
`  });
`  it("rejects invalid widths", () => {
`    expect(() => wordWrap("x", 0)).toThrow(RangeError);
`  });
`  it("keeps emoji intact", () => {
`    expect(wordWrap("👋 hi", 3)).toBe("👋\nhi");
`  });
`});
````
`
`Use known-good vectors where they exist (RFC test vectors for hashes and encodings, published examples for finance formulas). Run `npm run test:watch`.
`
`## 4. Build the UI
`
`### Text in → text out: `TransformTool`
`
````tsx
`"use client";
`
`import { TransformTool } from "@toolwright/ui";
`import { wordWrap } from "@toolwright/core/word-wrap";
`
`export default function Tool() {
`  return (
`    <TransformTool
`      sample="The quick brown fox jumps over the lazy dog."
`      options={[{ type: "number", key: "width", label: "Wrap at", default: 20, min: 1, max: 200 }]}
`      transform={(input, o) => wordWrap(input, Number(o.width))}
`    />
`  );
`}
````
`
``TransformTool` props worth knowing:
`
`| Prop | Purpose |
`| --- | --- |
`| `options` | Array of `select`, `toggle`, `number` or `text` options. Values arrive in `transform` as the second argument. |
`| `transform(input, options)` | Sync or async. Throw to show an error. |
`| `sample` | Adds a "Sample" button. Always provide one — it makes the tool self-explanatory. |
`| `inputLabel` / `outputLabel` | Accessible labels and headings. |
`| `acceptFile` | Enables "Open file" (e.g. `".json,.txt"`). |
`| `hideInput`, `runOnEmpty`, `regenerate` | For generators that need no input (UUIDs, lorem ipsum). |
`| `shareable` | Mirror state into the URL hash (default `true`). Turn off for generators and secrets. |
`| `renderExtra({ input, output, options })` | Add statistics or notes below the editors. |
`| `outputFilename`, `outputMime` | Used by the Download button. |
`
`### Anything else: `custom`
`
`Compose primitives from `@toolwright/ui` (`Field`, `Input`, `Select`, `Panel`, `Alert`, `Stat`, `CopyButton`, `DownloadButton`, `FileDropzone`…). Use `useShareableState` for state that should survive reloads and be shareable. Look at `color-converter`, `jwt-decoder` and `loan-calculator` for examples, and `merge-pdf` / `image-compressor` for file workflows.
`
`#### Show the answer, not a box
`
`For calculators and converters, put the headline number in a `ResultSlab` and the detail in a `StatGrid` (or a table) below it. Do not build your own tinted result box.
`
````tsx
`import { ResultSlab, Stat, StatGrid } from "@toolwright/ui";
`
`<ResultSlab label="Monthly payment" value={fmt(monthly)} valueTestId="loan-monthly" />
`<StatGrid>
`  <Stat label="Total interest" value={fmt(totalInterest)} />
`  <Stat label="Total paid" value={fmt(total)} />
`</StatGrid>
````
`
`Use `Alert` (a left color bar, never a tinted box) for errors and notes, `Badge` (a square mono stamp) for tiny labels, `SegmentedControl` for 2–4 modes and `Toggle` for on/off. A highlighted state is `bg-marker text-marker-foreground`. Tools are placed on the `Plate` automatically, so you never draw your own frame.
`
`### File tools
`
`- Read files with `file.arrayBuffer()` and pass bytes to `core`.
`- Wrap async work in `useJob()` (from `shared/pdf-ui`) so you get busy and error state for free.
`- Show sizes before and after, and give clear errors for corrupt or unsupported files.
`- Never keep object URLs around: revoke them (`URL.revokeObjectURL`) when you replace or unmount.
`- Mention in the copy that files never leave the device.
`
`## 5. Fill in the metadata
`
````ts
`export default defineTool({
`  slug: "word-wrap",
`  name: "Word Wrap",
`  tagline: "Wrap long lines of text at a fixed width.",
`  description: "Hard-wrap text at any column width, perfect for emails, commit messages and code comments. Runs in your browser; nothing is uploaded.",
`  category: "text",
`  keywords: ["word wrap", "line wrap", "wrap text", "hard wrap", "fold text"],
`  icon: WrapText,
`  howTo: ["Paste your text.", "Choose the column width.", "Copy the wrapped result."],
`  faq: [{ question: "Does it split inside words?", answer: "No. Lines break between words unless a single word is longer than the width." }],
`  related: ["whitespace-cleaner", "line-tools"],
`});
````
`
`Constraints enforced by tests (`packages/tools/tests/registry.test.ts`):
`
`- `name` ≤ 48 chars; `tagline` 20–110; `description` 60–420.
`- At least 3 unique `keywords` — include the phrases people actually search for.
`- Every `related` slug must exist and not be itself.
`- FAQ questions end with `?`.
`- File tools (image / PDF) must mention that processing is local.
- The search fields in [Search fields](#search-fields-required-by-tests): title 25-47, description 110-160, answer 80-320, one unique primary keyword, a FAQ and 3 steps, valid `nextStep` (`packages/tools/tests/seo.test.ts`).
`- Copy must never market the project as self-hostable.
`
``howTo` and `faq` appear on the page *and* as structured data (HowTo / FAQPage) for search engines, so add them for tools people will search for.

### Search fields (required by tests)

Every tool also carries the copy that search engines and answer engines read. Read [seo.md](seo.md) first; the short version:

```ts
  primaryKeyword: "word wrap",                       // the one query this page owns; lower case, unique across tools
  seoTitle: "Word Wrap Text Online, Free",           // 25-47 characters, contains the primary keyword, NO brand
  seoDescription: "Wrap text at any column width ...", // 110-160 characters, unique, a benefit and the privacy angle
  answer: "Word Wrap breaks long lines at a column width in your browser ...", // 80-320 characters, quotable on its own
  nextStep: { slug: "whitespace-cleaner", text: "Messy spacing too? Remove extra spaces and line breaks." },
```

- **Choose the primary keyword first.** What would a person type? Check [keyword-map.md](keyword-map.md): a test fails if another tool owns it, or if you list another tool's primary query as one of yours. Add your tool to `packages/tools/src/seo/keyword-map.ts` (primary, intent, 5-15 secondary queries, modifiers, what you say better). Volume and difficulty there are estimates; say so, do not invent numbers.
- **Title:** primary keyword first, a modifier only where it reads naturally, never the brand (the page adds ` | Toolwright`).
- **Description:** one clear benefit, the privacy angle if true, no repetition of the title.
- **Answer:** one to three sentences: what it does, that it runs in the browser, and its main limit. It is the first paragraph under the H1.
- **FAQ and steps:** at least one question and three steps for every tool. Questions are real ones people ask, answers are one to three sentences and honest about limits. Check each step against the controls.
- **Next step:** required on popular tools; descriptive anchor text, never "click here".
- `npm run docs:seo` regenerates `docs/keyword-map.md`.
`
`## 6. Check and ship
`
````bash
`npm run lint
`npm run typecheck
`npm test
`npm run docs:tools        # updates docs/tools.md
`npm run e2e               # when you touched UI, routing or file handling
````
`
`Open the tool in the browser too: try keyboard-only use, narrow widths (~360px), light and dark themes, empty input, huge input and garbage input.
`
`## Checklist
`
`- [ ] Logic is in `core`, pure, and tested (including edge cases and bad input)
`- [ ] No network calls, no third-party scripts/fonts, nothing sent anywhere
`- [ ] Errors are readable by non-developers
`- [ ] Every control has a label; works with keyboard; contrast meets WCAG AA
`- [ ] Layout works at 360px wide, in light and dark themes
`- [ ] Built from shared primitives (`ResultSlab` for the headline answer); tokens only, no gradients or tinted result boxes
`- [ ] `sample` provided for text tools; sensible defaults so the tool does something immediately
`- [ ] `meta.ts` has accurate copy, synonyms in `keywords`, `related` tools, and `howTo`/`faq` if it's a popular tool
- [ ] SEO: `primaryKeyword`, `seoTitle`, `seoDescription` and `answer` written for people, a FAQ and steps that match the page, a `nextStep` on popular tools, an entry in `keyword-map.ts`, and `npm run docs:seo` run
- [ ] Every claim is true: no ratings, no user counts, no "best" or "#1", and limits stated (a test scans for the first two)
`- [ ] Honest about limitations (security, lossy formats, browser support)
`- [ ] `npm run lint && npm run typecheck && npm test` pass; `docs/tools.md` regenerated
`
`## Lessons from recent tools
`
`Small things that cost time on the last ten tools. Check them before you open a pull request.
`
`- **Pasted text that can hold secrets** (cURL commands, HTTP headers, tokens) must not go through \`useShareableState\`. Use \`TransformTool shareable={false}\` or plain \`useState\`.
`- **Never throw inside a React state updater.** Compute the new value first inside your \`try/catch\`, then call \`setState\`. A throw inside the updater crashes the whole tool ("This tool failed to load").
`- **Do not copy paths or arrays per node when walking a tree.** Store a parent pointer and build the path only for results. Copying makes deeply nested input quadratic and ran a test out of memory.
`- **Tools that need the DOM** (for example HTML parsing) keep the logic in \`core\` but call \`DOMParser\` only inside one function, and the test file starts with \`// @vitest-environment jsdom\`. Catch \`RangeError\` and turn it into a readable "nested too deeply" message.
`- **\`Date.parse\` accepts junk** such as \`"0"\` (year 2000). Check the shape of a date before trusting it.
`- **Test the headline rule from the standard**, not only your own examples. Two missing values compare equal in JSONPath filters, which surprised the first set of tests.
`- **\`Alert\` has \`role="alert"\` only for \`tone="error"\`.** Tests that look for an alert need an error tone. Warnings and notes are plain status regions.
`- **Playwright labels:** the tool plate and the how-to section also carry the tool name as an accessible label, so \`getByLabel("JSON")\` can match three elements. Prefer \`getByRole("textbox", { name, exact: true })\`.
`- **Pipe-free test runs:** \`npx playwright test … | tail\` hides the exit code. Read the "failed" line or use \`--reporter=line\` and check \`$?\`.
`- **Heavy libraries load on demand, in one file.** PDF.js (about 1.7 MB) is imported with `await import()` from `shared/pdf-raster.ts` only; `packages/tools/tests/bundle-isolation.test.ts` fails if anything else mentions it. Do the same for any large dependency.
- **Bundlers rewrite worker entries.** Your own worker (`new Worker(new URL("./x.worker.ts", import.meta.url))`) works, but a third-party worker such as PDF.js's never finished its handshake inside Turbopack's wrapper. Copy it to `apps/web/public/` with a script (see `scripts/copy-pdfjs-assets.mjs`) and start it from a plain URL.
- **The production CSP has no `'wasm-unsafe-eval'`.** Dev mode has `'unsafe-eval'`, which hides this. Anything that needs WebAssembly must be tested against `npm run build && npm start` (the e2e suite does) and needs a JavaScript fallback or a deliberate CSP change.
- **Browsers apply the EXIF turn when decoding a JPEG, even with `imageOrientation: "none"`.** PDFs ignore EXIF, so strip the EXIF segment (`stripJpegExif` in core) before drawing the image to a canvas.
- **Abandoned async work must still reset your "busy" flag.** If an effect starts a slow draw and is replaced before it finishes (the user cleared the text), the old run is ignored, so the new branch has to clear `busy` itself. Otherwise the UI sticks on "Drawing…".
- **Playwright's `fill()` is very slow for tens of thousands of characters** in a textarea. To test a huge paste, set the value with the native setter and dispatch an `input` event (see `e2e/mermaid.spec.ts`); the tool itself handles it in milliseconds.
- **Give each heavy library its own worker and client.** See `shared/gif.worker.ts` + `gif-client.ts`: the page imports only the client (types come from the worker with `import type`, which is erased), so the library is not in the page bundle. A constant the page also needs (for example the tracing size limit) goes in its own tiny file (`core/src/image-trace-limits.ts`), because importing it from the heavy module would pull the library into the page.
- **Transferring an `ArrayBuffer` detaches it.** If you want to reuse the pixels (try again with other settings), send a copy (`buffer.slice(0)`), as `GifSession.make` and `traceInWorker` do.
- **A new request must replace an old one.** The clients reject the older request or terminate its worker, and the Tool ignores the rejection (`GifAborted`, `TraceAborted`), so a slow old run can never overwrite a newer result.
- **DOMPurify drops `<use>` by default.** The sanitizer adds it back with `ADD_TAGS` and keeps only `#local` references in its attribute hook.
- **Browsers show GIF delays of 10 ms or less as 100 ms**, so the GIF tools never write a delay below 20 ms.
- **jsdom has no `URL.createObjectURL`.** `useObjectUrl` checks for it so smoke tests mount; real browsers always have it.
- **The design-rule test scans source words.** The words "gradient", "blur", "glow" and "backdrop-" must not appear in `apps/web/src`, `packages/ui/src` or `packages/tools/src`, even in an FAQ answer or a variable name. Say "colour fade" or "soften" instead.
- **`SegmentedControl` radios are visually hidden.** In Playwright click the label text (`getByRole("radiogroup", { name }).getByText("Wave").click()`), not `check()` on the radio.
- **An `aria-label` that contains another field's label breaks `getByLabel`** (a button named "Random seed" next to a field named "Seed"). Give buttons a visible text name instead.
- **Never offer a bigger file.** Run the result through `pickSmaller` and give the original back with an honest message when nothing was gained.
- **Honest scope:** check \`docs/tools.md\` for an existing tool before you promise a new one fills a gap. The PDF organizer overlaps Extract and Rotate; its value is the visual list and the duplex collation.
- **Results that arrive after a pause need a waiting assertion.** The crop tool saves 400 ms after the last change, so a test that reads its "Result" number straight after typing gets the old value. Wait for it to change (`expect(el).not.toHaveText(oldValue)`) before you read it.
- **Never show a refusal on top of the error that caused it.** Page 9 of a 2-page PDF gave "Page 9 is out of range" and also "No pages are selected", two alerts for one mistake (and an ambiguous test locator). Work out the second message only when the first is absent.
- **Round whole pixels before you place things.** A drag that keeps a box's shape computes a width from a height; round both first and then position the box from its fixed corner, or the corner drifts by a pixel with every drag. In the same way `792 * 150 / 72` is `1650.0000000000002`, so `Math.ceil` made a 1651-pixel page; subtract a tiny epsilon before rounding up.
- **Control characters are not valid in XML, even escaped.** A Code 128 barcode can hold a tab or a bell. Putting it in an SVG `<title>` produced a file that libvips refused, and any strict XML parser would too. Replace such characters when you escape text for SVG.
- **Maps built from file keys need no prototype.** An XML tag named `__proto__` is legal. `Object.create(null)` makes it an ordinary key instead of changing the object, and `JSON.stringify` handles it.
- **Cap recursion you do not control.** The XML reader and writer are iterative and survive 50,000 levels, but turning a tree into nested JSON objects recurses (in `JSON.stringify` too), so the converter stops at 1,000 levels with a message. Pretty-printing 50,000 levels would write gigabytes of indentation, so output over 60 million characters is refused.
- **`ajv` cannot run here.** It builds validators with `new Function`, and the production CSP has no `'unsafe-eval'`. For JSON Schema use a library that interprets the schema (for example `@cfworker/json-schema`) and test it against `npm run build && npm start`.
- **Pointer-only controls need a second way in.** The crop box can be dragged, but it also has typed left, top, width and height fields and arrow keys, because dragging is no use to a keyboard or a screen reader. Handles are `aria-hidden`; the box is a focusable group.
- **A name that is also a segmented option is not a good label.** In the subnet tool a text field called "Network" shares its name with a tab called "Network". Use `getByRole("textbox", { name, exact: true })` in tests, or give the field a more specific name.
- **Playwright can read downloads back.** The PDF to Images test opens the ZIP with `unzipSync` from `fflate` and reads the pixel size from the PNG header, so a "download works" test also proves the file is what it says.
`
`
`## Conventions
`
`- **Naming.** Slugs are kebab-case nouns or noun phrases ("hash-generator"); components are `Tool`; core functions are camelCase verbs ("convertCase").
`- **Styling.** Use Tailwind with the design tokens (`bg-card`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-marker`…) instead of raw colors, so light and dark themes both work. **No gradients, glows, blur, pill badges, purple or orange**; sample colors should come from the brand tokens. These are enforced by `apps/web/tests/design-rules.test.ts`. See [design-system.md](design-system.md) and [design-language.md](design-language.md).
`- **Dependencies.** Prefer the platform. If you must add a package, add it to the package that uses it (`core` for logic), pin a sensible range, and mention why in the PR.
`- **Performance.** Keep heavy libraries out of `core/index.ts`; import from the specific module so tools only bundle what they use. Debounce expensive work.
`- **Secrets.** Tools that handle secrets (passwords, tokens, keys) must set `shareable={false}` or avoid `useShareableState`, so values don't end up in a URL.
