# Contributing to Toolwright

Thank you for helping build Toolwright! Contributions of every size are welcome: new tools, bug fixes, tests, accessibility improvements, documentation and translations of help text.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## The ground rules

These are what make Toolwright *Toolwright*. Pull requests that break them can't be merged.

1. **Tools never send user input anywhere.** No `fetch`, no analytics, no third-party scripts or fonts. The site's Content Security Policy (`connect-src 'self'`) blocks outside calls and the end-to-end tests fail if a tool tries.
2. **Logic is pure and tested.** Put the real work in `packages/core` as plain TypeScript functions (no React, DOM or network) with unit tests.
3. **Be honest in the copy.** Say what a tool can't do. Never overstate security — the cipher tools say plainly they aren't secure; the image compressor explains PNG is lossless.
4. **Accessible by default.** Label every control, support keyboard use, keep color contrast at WCAG AA, and don't rely on color alone. CI runs axe on key pages.
5. **Keep dependencies light.** Prefer platform APIs. A new package needs a clear reason and a license compatible with MIT.

## Getting set up

```bash
git clone https://github.com/RaydanAridiCS/toolwright.git
cd toolwright
npm install
npm run dev                          # http://localhost:3000
npx playwright install chromium      # once, for end-to-end tests
```

You need Node.js 20+ and npm 10+. We use **npm workspaces** — please don't introduce pnpm or yarn lockfiles.

## Your first contribution: add a tool

```bash
npm run new-tool word-wrap -- --name "Word Wrap" --category text
```

The scaffold creates the metadata, UI, logic and tests and registers the tool. Then:

1. Implement the function in `packages/core/src/word-wrap.ts` and cover it in `packages/core/tests/word-wrap.test.ts` (empty input, unicode, huge input, bad input).
2. Shape the UI in `packages/tools/src/tools/word-wrap/Tool.tsx`. For text-in/text-out tools, `TransformTool` gives you input, output, options, copy, download, sample data and shareable links.
3. Fill in `meta.ts`: a clear tagline, a description that mentions it runs in the browser, synonyms in `keywords`, and `related` tools. Add `howTo` and `faq` for popular tools — they appear on the page and in structured data for search engines.
4. Run the checks (below), then open a pull request.

The complete guide, including the conventions for file and PDF tools, is in [docs/writing-a-tool.md](docs/writing-a-tool.md).

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run docs:tools        # if you added or renamed a tool
npm run e2e               # when you changed UI, routing, security headers or file handling
```

CI runs the same checks plus a coverage report and the full Playwright suite (including accessibility audits in light and dark themes).

### What reviewers look for

- Does the logic have tests, including edge cases and invalid input?
- Is the error message something a non-developer could act on?
- Does it work with the keyboard and a screen reader? Is it usable at 360px wide?
- Is the copy accurate, with no overclaiming?
- Does it follow the [design rules](docs/design-language.md)? Tokens and shared components only; no gradients, glows, blur, pill badges, purple or orange (a test fails the build if they appear).
- Is the diff focused? Please keep unrelated refactors out of tool PRs.

## Commit and PR style

- Write commit messages in the imperative: "Add word wrap tool", "Fix JSON error position for tabs".
- One logical change per pull request. Link the request-board idea or issue it addresses.
- Screenshots or short clips are very welcome for UI changes (light and dark).

## Reporting bugs and suggesting improvements

- **Bug:** open an issue with the tool name, what you did, what you expected and what happened. Browser and OS help a lot. Please **don't paste private data** into issues; a minimal anonymized example is better.
- **Privacy concern:** treat as high priority. If it could expose users to harm, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.
- **New tool idea:** add it to the [request board](https://toolwright.com/requests) so others can vote.

## Project structure and deeper docs

| Doc | What's in it |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | How the monorepo, registry and rendering fit together |
| [docs/writing-a-tool.md](docs/writing-a-tool.md) | Step-by-step tool authoring guide and conventions |
| [docs/testing.md](docs/testing.md) | Testing strategy, how to run and write each kind of test |
| [docs/design-language.md](docs/design-language.md) | The "Workshop Ledger" concept, principles, voice and what we deliberately avoid |
| [docs/design-system.md](docs/design-system.md) | Tokens, type, components, motion and accessibility rules |
| [CHANGELOG.md](CHANGELOG.md) | What changed, release by release |
| [docs/privacy-model.md](docs/privacy-model.md) | How privacy is enforced and verified |
| [docs/request-board.md](docs/request-board.md) | The tool-request API and database |
| [docs/maintainers.md](docs/maintainers.md) | Environment variables, migrations and releases |
| [docs/roadmap.md](docs/roadmap.md) | Ideas we'd love help with |

Thank you for making the web a little more private.
