# SEO and answer-engine optimisation

This is how Toolwright is made findable in search engines (Google, Bing, DuckDuckGo) and in answer engines (Google AI Overviews, ChatGPT search, Perplexity, Copilot, Claude), and how to keep it that way.

## What code can and cannot do

Nobody can guarantee a ranking, and this project never promises one. Large sites with years of authority compete for the same queries. What the code can do:

- technical SEO: crawlable, fast, correct canonicals, a truthful sitemap, no accidents;
- on-page SEO: a title, description, heading and first paragraph that answer the query;
- structured data that describes what the page really shows;
- content that fully answers each query, and honest limits;
- internal links, performance and access for search and AI crawlers.

What it cannot do: build links from other sites, submit the site to Search Console, measure real rankings, or run analytics. **The site has no analytics on purpose**, so measurement happens on the owner's side in Google Search Console and Bing Webmaster Tools (see `owner-notes/06-seo-and-aeo.md`).

The angle that is true and that big sites cannot claim is *your files never leave your device, no upload, no sign-up, no watermark*. Every page leans on it, and every sentence on the site must stay true. No ratings, reviews, user counts or "trusted by" claims, ever (a test fails on them).

## Where things live

| What | Where |
| --- | --- |
| Per-tool SEO fields | each tool's `meta.ts`: `primaryKeyword`, `seoTitle`, `seoDescription`, `answer`, `nextStep`, plus `howTo` and `faq` |
| Rules for those fields | `packages/tools/tests/seo.test.ts` |
| Research behind them (queries, intent, estimates) | `packages/tools/src/seo/keyword-map.ts`, shown in [keyword-map.md](keyword-map.md) |
| Category pages (H1, title, description, intro) | `packages/tools/src/seo/category-content.ts` |
| Guides | `apps/web/src/content/guides.ts` |
| Page metadata (title, canonical, social cards) | `apps/web/src/lib/seo.ts` (`pageMetadata`) |
| JSON-LD builders | `apps/web/src/lib/structured-data.ts` |
| Crawler policy | `apps/web/src/lib/crawler-policy.ts`, used by `app/robots.ts` |
| `llms.txt` and `llms-full.txt` | `apps/web/src/lib/llms.ts`, served by `app/llms.txt` and `app/llms-full.txt` |
| Sitemap and its dates | `apps/web/src/app/sitemap.ts`, `scripts/gen-lastmod.mjs`, `apps/web/src/lib/lastmod.generated.json` |
| Redirects and headers | `apps/web/next.config.ts` |
| IndexNow | `scripts/indexnow.mjs` (runs on your machine only) |

## The fields of a tool

| Field | Rule (tested) | What it is for |
| --- | --- | --- |
| `primaryKeyword` | lower case, unique across tools, in the title and in the answer | the one query this page owns |
| `seoTitle` | 25 to 47 characters, no brand, contains the primary keyword, unique | the `<title>`; the page adds ` | Toolwright`, so the full title stays within 60 characters |
| `seoDescription` | 110 to 160 characters, unique, no brand | the meta description and the social card text |
| `answer` | 80 to 320 characters, contains every word of the primary keyword | the first paragraph under the H1; written so it can be quoted on its own |
| `howTo` | at least 3 steps | the visible steps and the HowTo markup |
| `faq` | at least 1 question; questions end with `?`; answers up to 600 characters | the visible FAQ and the FAQPage markup |
| `nextStep` | a real, different tool; a sentence of 15 to 120 characters; required on popular tools | the "Next step" link |

The older fields keep their own rules (`name` up to 48 characters, `tagline` 20 to 110, `description` 60 to 420, at least 3 `keywords`). `keywords` now only feeds the in-site search; they are no longer printed on the page.

## Choosing the primary keyword

1. Write down what a person would type to get this job done ("compress pdf", not "PDF size optimization utility").
2. Check [keyword-map.md](keyword-map.md) so you do not pick a query another tool already owns. A test fails if two tools share a primary keyword, or if one tool lists another's primary as a secondary query.
3. When two tools overlap, one owns the query and the other links to it. Today: Compress PDF owns "compress pdf" and links to Split PDF and Merge PDF; PDF to Images owns "pdf to jpg", Images to PDF owns "jpg to pdf"; Subnet Calculator owns "subnet calculator"; Time Zone Converter owns "time zone converter" and Meeting Planner owns "meeting planner".
4. Prefer improving titles and copy to renaming a slug (see below).

## Writing the copy

- **Title.** Primary keyword first, a modifier such as "Online", "Free" or "No Upload" only where it reads naturally, no brand (the template adds it). Never stuff keywords.
- **Description.** One clear benefit, the privacy angle where it is true, a reason to click. Do not repeat the title word for word.
- **Answer.** One to three sentences that say what the tool does, how it runs ("in your browser, nothing is uploaded") and its main limit. Imagine it quoted alone in an AI answer: it must be true and complete.
- **FAQ.** Real questions people ask ("How do I convert X to Y?", "Is my file uploaded?", "What are the limits?"). Answers of one to three sentences. Include limits honestly: no OCR, lossy formats, size caps.
- **Steps.** Three short steps that match the controls on the page. Check them against the tool before you write them.
- **Next step.** Where the person goes after this job (Compress PDF, then Merge PDF), with descriptive anchor text, never "click here".
- **Never** disparage a competitor by name, promise a ranking, or write a claim the tool cannot honour. "Compress to exactly 100 KB" is not a feature, so the guide says there is no such setting.

## Structured data

Built by `lib/structured-data.ts` and tested by parsing the output (`apps/web/tests/seo.test.ts`) and by reading it from raw HTML in the production build (`e2e/seo.spec.ts`).

| Page | Markup |
| --- | --- |
| Home | Organization (with the GitHub repository in `sameAs`), WebSite with a SearchAction (the URL `/tools?q=` really filters the catalogue), FAQPage |
| Tool | WebApplication (name, url, description, `applicationCategory`, `operatingSystem: Any`, `browserRequirements`, `isAccessibleForFree`, a price-0 Offer, `featureList`, publisher), BreadcrumbList, FAQPage, HowTo |
| Category and `/tools` | CollectionPage with an ItemList of every tool, BreadcrumbList |
| Guide | Article (true published and modified dates, Organization author), BreadcrumbList, FAQPage |

There is no `aggregateRating`, no review markup and no invented numbers. Google has limited the rich results it shows for FAQ and HowTo, but the markup still helps answer engines understand the page, so it is kept accurate: every question and step in the markup is also on the page.

## Crawlers and AI bots

`robots.txt` is generated from `lib/crawler-policy.ts`:

- **Search and answer crawlers are always allowed**: Googlebot, Bingbot, DuckDuckBot, Applebot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User. They fetch pages so the site can be found and cited, which is the goal.
- **Training crawlers are the owner's decision**: GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended. They are **allowed by default**. To block them, build with `TOOLWRIGHT_AI_TRAINING=block` (for example in the Docker build environment); the same crawlers are then given `Disallow: /`. Search and answer crawlers are not affected.
- `/api/` is disallowed for everyone, and nothing that renders a page (CSS, JavaScript, fonts) is blocked.
- Every named group repeats the `/api/` rule, because a crawler that matches a named group ignores the `*` group.

`/llms.txt` is a short Markdown index (what the site is, categories, popular tools, guides). `/llms-full.txt` has every tool's answer, steps and FAQ. Both are generated from the same registry as the pages, so they cannot drift. No major search engine has said it uses them for ranking; they are cheap, accurate context for tools that do read them.

## Sitemap and dates

`sitemap.xml` lists every indexable URL: home, `/tools`, categories, tools, guides and the static pages (133 at the time of writing). `priority` and `changefreq` are left out because search engines ignore them. `lastmod` is the date the page's source last changed:

- tools: the last commit that touched `packages/tools/src/tools/<slug>/` (or today, if it has uncommitted changes);
- categories, `/tools` and `/`: the newest of their tools;
- guides: the `updated` date in `guides.ts`, which must change only when the guide really does.

`scripts/gen-lastmod.mjs` writes `lastmod.generated.json`. It runs in `prebuild` when a git checkout is present, and does nothing in a Docker build without `.git` (the committed file is used). Run it by hand and commit the result before a release.

## Preferred host and redirects

The preferred host is the apex, **`https://toolwright.com`**; every canonical, sitemap URL and social card uses it. `next.config.ts` redirects `www.toolwright.com` to it with a permanent 308 (production only). Next.js already redirects `/path/` to `/path` with a 308. HTTP to HTTPS is a hosting-layer job: put a TLS-terminating proxy or platform in front and redirect there. The app's policy also upgrades insecure requests.

If you use another domain, set `NEXT_PUBLIC_SITE_URL` at build time; the www redirect follows it.

### Renaming a slug safely

Prefer improving the title and copy. If a slug must change:

1. Rename the folder `packages/tools/src/tools/<old>` to `<new>` and change `slug:` in its `meta.ts`.
2. Add a permanent redirect to `redirects()` in `apps/web/next.config.ts`: `{ source: "/tools/<old>", destination: "/tools/<new>", permanent: true }`. **Keep it forever**: old links and old search results keep arriving.
3. Search for the old slug in `related`, `nextStep`, `FEATURED_SLUGS`, `guides.ts`, `keyword-map.ts` and the docs, and update each.
4. Run `node scripts/gen-registry.mjs`, `npm run docs:tools` and `npm run docs:seo`. The sitemap follows the registry on its own.
5. Add a line to `e2e/seo.spec.ts` that requests the old URL without following redirects and expects a 308 to the new one.

## Adding a guide

1. Add an entry to `GUIDES` in `apps/web/src/content/guides.ts`: `slug`, `seoTitle` (25 to 47 characters), `h1`, `seoDescription` (110 to 160), an answer-first `answer`, `published` and `updated` (the real date), the `tools` it uses, `sections` made of paragraphs, lists, tables and `tool` blocks, and a `faq`.
2. Write only what you can make accurate and better than what already exists. Check every statement about a tool against the tool. Link to the tool with a descriptive sentence.
3. The tests enforce the length bands, true dates, at least 350 words, three sections, a link to a real tool and no banned words. The guide is added to the sitemap, `llms.txt`, the guides index and the pages of the tools it lists automatically.
4. Add the page to `PAGES` in `e2e/a11y.spec.ts` if it is a new kind of page.
5. Change `updated` only when you change the content in a way a reader would notice.

Guides are bylined to the Toolwright team and say so; the policy ("every statement is checked against what the tool does; the date is the date of the last real edit") is on `/guides`.

## Link previews (WhatsApp, Facebook, LinkedIn, X, Telegram, Slack, Discord)

When someone pastes a Toolwright link into a chat or a post, the app reads the page's Open Graph tags (`og:title`, `og:description`, `og:image`) and shows a card. None of those apps run JavaScript or log in, so the tags have to be in the HTML the server sends.

How it is built:

- `pageMetadata()` in `apps/web/src/lib/seo.ts` is the only place that writes a page's social tags. Every page gets its own card at `<path>/opengraph-image`: `/opengraph-image`, `/tools/opengraph-image`, `/tools/<slug>/opengraph-image`, `/category/<id>/opengraph-image`, `/guides/opengraph-image`, `/guides/<slug>/opengraph-image`, `/requests/...`, `/about/...`, `/privacy/...` and `/contribute/...`. Before this, every page except the tools shared the home card, whose caption read "TOOL CATALOGUE".
- Cards are drawn at build time by `renderOgCard()` in `apps/web/src/lib/og-card.tsx` (a printed plate with the name, a marker bar and one or two lines of text). Long names step down in size so they stay on two lines, and `shortLine()` ends a tagline at a whole sentence.
- The image entry carries what crawlers read: an absolute `https://` URL, `og:image:type` (`image/png`), `og:image:width` and `height` (1200 by 630), `og:image:alt` and `og:image:secure_url`. Guides use `og:type` `article` with their real published and modified dates; everything else is `website`.
- WhatsApp may skip images over about 300 KB. The cards are 55 to 80 KB.

To add a card for a new kind of page, put an `opengraph-image.tsx` next to its `page.tsx` that returns `renderOgCard({ name, tagline, caption })` (copy `apps/web/src/app/requests/opengraph-image.tsx`), and `pageMetadata()` will point to it with no further change.

Tests: `apps/web/tests/seo.test.ts` (tags, article dates, tagline shortening) and, in `e2e/seo.spec.ts`, a check that every page in the sitemap names a card, that every card answers 200 as a 1200x630 PNG under 300 KB, and that requests that identify themselves as WhatsApp, Facebook, X, LinkedIn, Telegram, Slack and Discord get the tags inside `<head>`, near the top of the HTML.

What code cannot check: how each app draws the card, and whether bot protection in front of the server lets the crawlers in. `npm run check:deploy` makes a WhatsApp-style request against the live site and fetches the home card, which catches a block, but it is not WhatsApp. The apps also keep their own cache of a link's preview, often for days. To see a changed preview straight away: Facebook and Messenger have the [Sharing Debugger](https://developers.facebook.com/tools/debug/) with "Scrape Again"; LinkedIn has the [Post Inspector](https://www.linkedin.com/post-inspector/); Telegram refreshes through the `@WebpageBot` bot; for WhatsApp and the rest, sharing the link with a throwaway query string (`https://toolwright.com/tools/merge-pdf?v=2`) normally gets a fresh preview. Sharing a link to yourself is the quickest way to look.

## IndexNow

`scripts/indexnow.mjs` tells Bing and other IndexNow engines about changed pages. It runs on your machine and is never called from the site or from a visitor's browser. `node scripts/indexnow.mjs init` makes a key file in `apps/web/public/`; deploy it so `https://toolwright.com/<key>.txt` is live; then `node scripts/indexnow.mjs submit` shows what it would send and `--send` sends it (`--since 2026-10-31` sends only pages changed since a date). Google does not use IndexNow.

## Checking a page

- **Raw HTML, as a crawler without JavaScript sees it:** `curl -s https://toolwright.com/tools/merge-pdf` and look for the `<title>`, description, canonical, one `<h1>`, the answer paragraph, the FAQ and the `application/ld+json` blocks. `e2e/seo.spec.ts` does this for a sample of pages and for every URL in the sitemap.
- **Structured data:** the [Schema.org validator](https://validator.schema.org) and Google's Rich Results Test accept a URL or pasted HTML. They are outside tools, run by you.
- **Lighthouse:** `npx lighthouse@12.8.2 http://localhost:3100/ --only-categories=performance,accessibility,best-practices,seo` against `npm run build && npm start`, with Chrome. Run it from a scratch folder; it is not a dependency of the project. Results from this round are in `owner-notes/06-seo-and-aeo.md`.
- **Accessibility:** `npm run e2e` runs axe on every kind of page in light and dark themes.

## What was measured, and what was not

Measured here: the HTML of the production build, Lighthouse in a lab (a simulated slow phone on a simulated slow 4G network), unit and end-to-end tests. **Not measured and not measurable from code:** real rankings, whether and when pages are indexed, field Core Web Vitals, and how answer engines choose what to cite. The volume and difficulty notes in the keyword map are estimates.
