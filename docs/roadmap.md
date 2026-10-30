# Roadmap

Ideas we'd love help with, roughly ordered by value. Vote on the [request board](https://toolwright.com/requests) or open an issue to claim one. Anything here must keep the core promise: **no tool input leaves the device**.

## Tools people ask for

- **Audio and video** — trim, convert and compress in the browser (WebAssembly FFmpeg). Must be bundled locally (the CSP forbids loading it from a CDN) and lazy-loaded.
- **Image background remover** — a small on-device model.
- **JSON** — JSON diff, three-way JSON merge, the JSON Schema generator and the JSONPath tester are built.
- **HEIC → JPG**, **animated GIF/APNG tools**. The favicon pack generator is built. The Mermaid diagram editor is built.
- **OCR** — text from images and scanned PDFs with a local engine.
- **Text** — text-to-speech preview using the Web Speech API. Readability scores and HTML → Markdown are built; Markdown → HTML is the Markdown Previewer's HTML tab.
- **Developer** — GraphQL formatter, Dockerfile linter, YAML validator and fetch → cURL are built. Still open: a `docker-compose` / Kubernetes manifest checker (needs schemas bundled locally), and a GraphQL query-against-schema validator.
- **Calculators** — unit price comparison, BMI (with honest caveats), the meeting time planner, mortgage affordability and the salary/hourly converter are built.
- **PDF** — Sign PDF (visual signatures) is built. A certificate-based digital signature is a separate, larger job that needs a security review. Compress PDF follow-ups: recompress lossless images that are clearly photographs, and let Smallest file keep selectable text with an invisible text layer (needs OCR). Page previews could also come to Split PDF and Extract PDF Pages, using the same renderer.

## Platform improvements

- Publish `@toolwright/core` to npm as a standalone, tree-shakeable library with its own README and examples.
- Nonce-based CSP to drop `'unsafe-inline'` from `script-src`.
- Precache every tool chunk for fully-offline use after install (opt-in, with a size indicator).
- Keyboard shortcut help dialog and per-tool shortcuts.
- Localized UI and tool help text (i18n).
- Embeddable tool widgets (`<iframe>`-free, web-component based) for blogs and docs.
- Visual regression tests (Playwright screenshots) for the highest-traffic tools.
- Tool usage ideas surfaced locally ("Because you used X…") using only on-device data.

## Quality

- More real-world fixtures for the image-metadata and PDF tools (rotated JPEGs, encrypted PDFs, huge files).
- Streaming/worker-based processing for very large files to keep the UI responsive (Web Workers).
- Screen-reader walkthroughs documented per tool category.
- Performance budgets: fail CI if a tool's JS exceeds an agreed size.

## Not planned

- User accounts, cloud storage or server-side processing of user files.
- Advertising or third-party tracking.
- Features that require sending user input to an API.
