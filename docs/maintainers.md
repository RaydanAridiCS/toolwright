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

## Releasing

1. Make sure `main` is green: lint, typecheck, unit tests, e2e (including accessibility).
2. `npm run docs:tools` and commit if `docs/tools.md` changed.
3. Bump `CACHE_VERSION` in `apps/web/public/sw.js` **only** if the caching strategy changed (build assets are content-hashed, so normal releases don't need it).
4. Tag the release (`vX.Y.Z`) and publish release notes grouped as *New tools · Improvements · Fixes*.
5. After deploy, spot-check: `/`, a tool page, `/requests`, `/sitemap.xml`, and the response headers (`curl -I https://toolwright.com/`).

## Dependency hygiene

- Review updates monthly. Prefer small, widely-used libraries. Current runtime dependencies of note: `pdf-lib` (PDF), `qrcode`, `marked` + `dompurify` (Markdown), `diff`, `js-yaml`, `papaparse`, `sql-formatter`, `cronstrue`, `exifr`, `fflate`, `@scure/bip39` (passphrase word list), `cmdk`, `zod`, `drizzle-orm`, `postgres`. Loaded on demand and kept behind one file each: `pdfjs-dist` (PDF page images), `mermaid` (diagrams), `svgo` (SVG optimizer, about 800 KB), `gifenc` and `omggif` (GIF encode and decode) and `imagetracerjs` (image tracing). `imagetracerjs` has had no release for years and ships no types (it is wrapped in `core/src/image-trace.ts` with one `@ts-expect-error`); if it ever becomes a problem, Image to SVG is the only tool that needs replacing.
- Anything that handles untrusted input (`marked`, `dompurify`, `js-yaml`, `pdf-lib`, `exifr`) deserves prompt security updates.
- `npm audit` runs against the lockfile; investigate anything reachable from user input.

## Monitoring ideas

The app intentionally has no telemetry. For uptime, a simple external check on `/` and `/api/requests` is enough. Build-time and bundle-size regressions can be watched with `next build` output in CI.
