# Maintainer notes

Operational details for people who run the official toolwright.com deployment or cut releases.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build | Canonical URL for metadata, sitemap and Open Graph (default `https://toolwright.com`) |
| `NEXT_PUBLIC_REPO_URL` | build | Link target for the GitHub buttons |
| `DATABASE_URL` | runtime | Postgres connection string for the request board. If unset, an in-memory store is used and the UI shows a demo-mode notice. |

`NEXT_PUBLIC_*` values are inlined at build time.

## Database

- Schema lives in `packages/db/src/schema.ts`; SQL migrations are generated into `packages/db/drizzle/` and **committed**.
- Create a migration: `npm run db:generate`. Apply: `DATABASE_URL=… npm run db:migrate`.
- Review the generated SQL before committing. CI applies every migration to an in-process Postgres (PGlite) in the test suite.
- Use a pooled connection string on serverless platforms. The app opens one connection per instance (`max: 1`, `prepare: false` for pooler compatibility).
- Hosted Postgres (Neon, Supabase, Railway, RDS and others) normally requires SSL: end the connection string with `?sslmode=require`.
- The app gives up on an unreachable database after 10 seconds, so visitors see an error instead of a hung page. `GET /api/health` tells you which problem it is (see the go-live checklist below).

### Moderating the request board

There is no admin UI by design (no accounts to protect). Use SQL:

```sql
-- change a status
update tool_requests set status = 'planned' where id = '…';
-- remove spam (votes cascade)
delete from tool_requests where id = '…';
-- see what's popular
select r.title, count(v.*) as votes
from tool_requests r left join tool_request_votes v on v.request_id = r.id
group by r.id order by votes desc limit 20;
```

## Hosting requirements

The site is a standard Next.js app: static pages plus two small Node route handlers. Any host that supports Next.js 16 works. Requirements to preserve the privacy model:

- Serve the headers from `next.config.ts` unmodified (especially `Content-Security-Policy`). If a proxy or CDN adds scripts (analytics, "email obfuscation", bot-challenge widgets), that breaks the CSP and the promise. Disable such features or update the policy deliberately and document it on the privacy page.
- Do not add third-party analytics. If aggregate stats are ever wanted, use a cookieless, first-party approach and update `/privacy` first.
- `/sw.js` must be served with `Cache-Control: no-cache` (already configured) so service-worker updates roll out.

## Container image

The repository's `Dockerfile` builds the web app as a small production image, for deploying the official site to any container platform. It uses Next.js's *standalone* output (enabled only for the image build via `NEXT_OUTPUT=standalone`, so `npm run build` / `npm start` are unchanged).

```bash
docker build -t toolwright \
  --build-arg NEXT_PUBLIC_SITE_URL=https://toolwright.com \
  --build-arg NEXT_PUBLIC_REPO_URL=https://github.com/<org>/toolwright .

docker run -p 3000:3000 -e DATABASE_URL=postgres://… toolwright
```

| Build argument | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://toolwright.com` | Canonical URLs, sitemap, Open Graph. Baked into the build. |
| `NEXT_PUBLIC_REPO_URL` | `https://github.com/RaydanAridiCS/toolwright` | GitHub links. Baked into the build. |
| `NEXT_BUILD_CPUS` | `4` | Build parallelism. Lower it if the build is killed for lack of memory (a constrained Docker VM can run out of RAM with many workers). |
| `NODE_VERSION` | `22` | Node.js major version for all stages. |
| `TOOLWRIGHT_AI_TRAINING` | unset (allow) | Set to `block` to tell AI *training* crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended) not to crawl. Search and answer crawlers stay allowed. Read at build time. See [seo.md](seo.md). |

Runtime environment: `DATABASE_URL` (optional; without it the request board uses its in-memory demo store), `PORT` (default `3000`).

What you get: a multi-stage build (~350 MB), running as a non-root user (`nextjs`, uid 1001), with a `HEALTHCHECK` that requests `/`. The security headers and service worker are served by the app itself, so they are present in the container exactly as in `npm start`.

### Migrations

The runtime image does not contain migration tooling. Apply migrations as a one-off job from the `migrate` build target, before starting a new version:

```bash
docker build --target migrate -t toolwright-migrate .
docker run --rm -e DATABASE_URL=postgres://… toolwright-migrate
```

### Verifying an image

The end-to-end suite can run against any running instance, including a container:

```bash
docker run -d -p 3000:3000 --name tw toolwright
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/privacy.spec.ts e2e/home.spec.ts e2e/requests.spec.ts
```

Remember to place a TLS-terminating reverse proxy or platform load balancer in front: the app serves plain HTTP and its CSP includes `upgrade-insecure-requests`. Keep any proxy from injecting scripts or analytics (see the hosting requirements above).

## Go-live checklist

`npm run check:deploy` reads the live site and prints PASS, WARN or FAIL for every line below, with the fix for each one that is not a PASS. It only makes GET requests and changes nothing. Pass a URL to check another host (`node scripts/check-deploy.mjs https://staging.example`). It exits 1 when anything FAILED, so it can gate a deploy.

| Check | What it proves | If it is not a PASS |
| --- | --- | --- |
| The site answers over HTTPS | `GET /` returns 200 | Check DNS, the container and the certificate. |
| `http://` goes to `https://` | Plain HTTP is redirected, with a 301 or 308 ideally | Turn on *Always Use HTTPS* at the CDN, or redirect port 80 at the proxy. |
| `www` redirects to the apex | `www.toolwright.com/tools/merge-pdf` ends at `toolwright.com/tools/merge-pdf` with a 301 or 308 | The name must reach the app (add it to the host's domains and the app's own redirect answers) or be redirected at the edge: a Cloudflare Redirect Rule from `https://www.toolwright.com/*` to `https://toolwright.com/${1}`, status 301, query string kept. A 503 means the host does not know the name. |
| Content-Security-Policy is intact | The policy still allows only the site's own origin | A proxy rewrote or removed the header. Serve the headers from `next.config.ts` unmodified. |
| No outside scripts in the page | Nothing was injected into the HTML | Turn off CDN features that inject scripts (Cloudflare Web Analytics auto-install, Rocket Loader, Email Address Obfuscation). They break the privacy promise and the policy. |
| Service worker is not cached | `/sw.js` is revalidated, so updates roll out | The app sends `no-cache` but the CDN overrides it. Cloudflare: *Browser Cache TTL* = *Respect Existing Headers*, plus a Cache Rule that bypasses cache for `/sw.js`. |
| `robots.txt`, `sitemap.xml`, `llms.txt` | They answer, name the real host and list 100+ URLs | `NEXT_PUBLIC_SITE_URL` is baked in at **build** time: set it as a build argument and redeploy. |
| Link-preview card and social crawlers | The home card is a 1200x630 PNG under 300 KB, and a WhatsApp-style request gets the full page | A firewall or bot-protection rule is blocking preview crawlers. Allow WhatsApp, facebookexternalhit, Twitterbot, LinkedInBot, TelegramBot, Slackbot and Discordbot. |
| Request board database and API | `/api/health` is healthy and `GET /api/requests` works | See the next section. |
| IndexNow key is live | Optional. The key file is deployed | `node scripts/indexnow.mjs init`, deploy, then submit. |

### The request board's database

1. Create a Postgres database with any provider.
2. Set `DATABASE_URL` as a **runtime** variable on the server (not a build argument), with `?sslmode=require` if the provider needs SSL.
3. Run the migrations once, and again after any release that adds one (see [Migrations](#migrations)).
4. Restart the app, then `curl https://toolwright.com/api/health`. A healthy board answers `{"ok":true,"database":{"mode":"postgres","state":"ok","persistent":true}}`.

`/api/health` never returns the connection string, the host or an error message. It answers 200 when the board works and 503 when it does not, so an uptime monitor can watch it. `state` says what is wrong:

| `state` | Meaning | Fix |
| --- | --- | --- |
| `unreachable` | The server cannot reach Postgres (refused, timed out, name not found, too many connections, starting up) | Check the host and port in `DATABASE_URL`, that the database is running, and its firewall or allow-list. |
| `rejected` | Postgres refused the login or the database name, or requires SSL | Check user, password and database name. Add `?sslmode=require`. |
| `not_migrated` | The connection works but the tables are missing | Run the migrations. |
| `error` | Anything else | Look for the log line that starts with `Request board database problem`. |

With `"mode":"memory"` there is no `DATABASE_URL`: the board works but keeps ideas in the server's memory, resets on every restart and shows visitors a "Demo mode" note. That is fine for local work and wrong for the live site.

While the database is down the rest of the site is unaffected. The board shows "The board is taking a break" with a *Try again* button, the API answers 503 with `Retry-After: 60`, and the home page ticket keeps what the visitor typed and links to the board. Do **not** point the container `HEALTHCHECK` at `/api/health`: a database outage would then restart containers that are serving the site fine.

### If the site is behind Cloudflare

Checked on the live site on 31 October 2026: the page HTML carried no injected script, and the security headers arrived unchanged. Settings to review:

- *Always Use HTTPS* on, so plain HTTP goes to HTTPS (a 301 is better than the 302 it sent then).
- *Browser Cache TTL* = *Respect Existing Headers*. At the default it rewrote `/sw.js` to `max-age=14400`.
- Web Analytics auto-install, Rocket Loader and Email Address Obfuscation off.
- Do not add a *Cache Everything* rule for HTML. Next.js sends `s-maxage=31536000` on pages, so cached HTML would outlive a deploy unless you purge it each time.
- If link previews stop working, look at *Security > Events* for blocks on WhatsApp, Facebook or Twitter user agents.
- Cloudflare adds `NEL` and `Report-To` headers. They make a visitor's browser report failed connections to Cloudflare (the browser does this itself, only on failures, and no page code is involved). Turn off *Network Error Logging* in the Network settings if you want no third-party reporting at all.

### Backups and monitoring

- Turn on your provider's automatic Postgres backups. The tables are small and hold only hashed tokens, titles and descriptions.
- Point an uptime monitor at `https://toolwright.com/api/health`.
- Run `npm run check:deploy` after every deploy.

## Releasing

1. Make sure `main` is green: lint, typecheck, unit tests, e2e (including accessibility).
2. `npm run docs:tools` and commit if `docs/tools.md` changed.
   Also `npm run docs:seo` (the keyword map) and `node scripts/gen-lastmod.mjs` (sitemap dates; commit `apps/web/src/lib/lastmod.generated.json` if it changed).
3. Bump `CACHE_VERSION` in `apps/web/public/sw.js` **only** if the caching strategy changed (build assets are content-hashed, so normal releases don't need it).
4. Tag the release (`vX.Y.Z`) and publish release notes grouped as *New tools · Improvements · Fixes*.
5. After deploy, run `npm run check:deploy` (see the go-live checklist above) and spot-check a tool page and `/requests` in a browser.
6. Optional: tell Bing about the changes with `node scripts/indexnow.mjs submit --since <date>` (see [seo.md](seo.md#indexnow)), and request indexing of new pages in Google Search Console.

## Dependency hygiene

- Review updates monthly. Prefer small, widely-used libraries. Current runtime dependencies of note: `pdf-lib` (PDF), `qrcode`, `marked` + `dompurify` (Markdown), `diff`, `js-yaml`, `papaparse`, `sql-formatter`, `cronstrue`, `exifr`, `fflate`, `@scure/bip39` (passphrase word list), `cmdk`, `zod`, `drizzle-orm`, `postgres`. Loaded on demand and kept behind one file each: `pdfjs-dist` (PDF page images), `mermaid` (diagrams), `svgo` (SVG optimizer, about 800 KB), `gifenc` and `omggif` (GIF encode and decode) and `imagetracerjs` (image tracing). `imagetracerjs` has had no release for years and ships no types (it is wrapped in `core/src/image-trace.ts` with one `@ts-expect-error`); if it ever becomes a problem, Image to SVG is the only tool that needs replacing.
- The crop, PDF to Images, PDF to Text, XML, subnet and barcode tools added no dependencies. PDF to Images and PDF to Text reuse `pdfjs-dist` (through `shared/pdf-raster.ts`) and `fflate` (ZIP), so a PDF.js upgrade is the thing to re-test for them: run `e2e/more-tools.spec.ts` and `e2e/files.spec.ts`. Their unit tests also read the PDF fixtures with PDF.js's Node build.
- Anything that handles untrusted input (`marked`, `dompurify`, `js-yaml`, `pdf-lib`, `exifr`) deserves prompt security updates. The XML reader is our own code; its tests include a billion-laughs file, an external-entity file and 50,000-deep nesting, so run them before changing it.
- `npm audit` runs against the lockfile; investigate anything reachable from user input.

## Monitoring ideas

The app intentionally has no telemetry. For uptime, a simple external check on `/` and `/api/requests` is enough. Build-time and bundle-size regressions can be watched with `next build` output in CI.
