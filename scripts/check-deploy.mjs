#!/usr/bin/env node
/**
 * Checks a running Toolwright site and says what is still missing on the server. It only makes GET and HEAD-style
 * requests, changes nothing, and runs on your machine (never from the site).
 *
 *   node scripts/check-deploy.mjs                          check https://toolwright.com
 *   node scripts/check-deploy.mjs https://staging.example  check another host
 *   npm run check:deploy
 *
 * Exit code 0 when nothing FAILED (warnings are advice), 1 otherwise, so it can gate a deploy.
 * What each check means, and how to fix it, is in docs/maintainers.md ("Go-live checklist").
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 20_000;
const MAX_CARD_BYTES = 300 * 1024;

/** The value of a meta tag by its property or name, e.g. metaContent(html, "og:image"). Undefined when absent. */
export function metaContent(html, key) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`(?:property|name)="${key}"`).test(t));
  return tag ? /content="([^"]*)"/.exec(tag)?.[1]?.replace(/&amp;/g, "&") : undefined;
}

/** Width and height of a PNG, or null when the bytes are not a PNG. */
export function pngSize(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 24 || b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** Script URLs on a page that do not come from the site's own origin. The privacy promise allows none. */
export function externalScripts(html, origin) {
  const found = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    const src = m[1];
    const url = new URL(src, origin);
    if (url.origin !== new URL(origin).origin || url.pathname.startsWith("/cdn-cgi/")) found.push(src);
  }
  return found;
}

/** Problems with a Content-Security-Policy header, in plain words. An empty list means it is as strict as it should be. */
export function cspProblems(csp) {
  if (!csp) return ["there is no Content-Security-Policy header"];
  const problems = [];
  for (const must of ["default-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
    if (!csp.includes(must)) problems.push(`the policy does not contain ${must}`);
  }
  if (csp.includes("wasm-unsafe-eval")) problems.push("the policy allows wasm-unsafe-eval");
  const hosts = csp.match(/https?:\/\/[^\s;]+/g);
  if (hosts) problems.push(`the policy names outside hosts: ${hosts.join(", ")}`);
  return problems;
}

/** What to do about each database state that /api/health can report. */
export const DATABASE_HINTS = {
  unreachable: "The server cannot reach Postgres. Check DATABASE_URL (host and port), that the database is running, and that its firewall allows this server.",
  rejected: "Postgres refused the connection. Check the user, password and database name in DATABASE_URL, and add ?sslmode=require if your provider needs SSL.",
  not_migrated: "The database is empty. Run the migrations once: docker build --target migrate -t toolwright-migrate . && docker run --rm -e DATABASE_URL=... toolwright-migrate (or DATABASE_URL=... npm run db:migrate).",
  error: "The database answered with an error. Read the server log line that starts with 'Request board database problem'.",
};

/** The 32-character hex name of the IndexNow key file in apps/web/public, or null. */
export function findIndexNowKey(dir = join(root, "apps/web/public")) {
  if (!existsSync(dir)) return null;
  const keys = readdirSync(dir).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  return keys.length === 1 ? keys[0].replace(/\.txt$/, "") : null;
}

const results = [];
const record = (status, name, detail = "", fix = "") => {
  results.push({ status, name, detail, fix });
  const mark = { pass: "PASS", fail: "FAIL", warn: "WARN" }[status];
  console.log(`${mark}  ${name}${detail ? `: ${detail}` : ""}`);
};
const pass = (name, detail) => record("pass", name, detail);
const fail = (name, detail, fix) => record("fail", name, detail, fix);
const warn = (name, detail, fix) => record("warn", name, detail, fix);

async function get(url, init = {}) {
  try {
    return await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
  } catch (err) {
    return { failed: err instanceof Error ? (err.cause?.code ?? err.message) : String(err) };
  }
}

async function run(site) {
  const origin = new URL(site).origin;
  const host = new URL(site).host;
  console.log(`Checking ${origin}\n`);

  // 1. The site answers over HTTPS.
  const home = await get(`${origin}/`);
  if (home.failed) {
    fail("The site answers", home.failed, "Check DNS, the hosting service and the TLS certificate.");
    return;
  }
  if (home.status !== 200) fail("The site answers", `GET / returned ${home.status}`, "Open the host's logs; the app should answer 200 on /.");
  else pass("The site answers over HTTPS", "GET / returned 200");
  const html = home.status === 200 ? await home.text() : "";

  // 2. Plain HTTP goes to HTTPS.
  if (origin.startsWith("https://")) {
    const plain = await get(`http://${host}/`);
    const where = plain.failed ? "" : (plain.headers.get("location") ?? "");
    if (plain.failed) warn("http:// goes to https://", plain.failed, "Turn on 'Always Use HTTPS' (Cloudflare) or redirect port 80 at the proxy.");
    else if (![301, 302, 307, 308].includes(plain.status) || !where.startsWith(`https://${host}`)) fail("http:// goes to https://", `got ${plain.status} ${where}`, "Redirect port 80 to HTTPS (Cloudflare: SSL/TLS > Edge Certificates > Always Use HTTPS).");
    else if (plain.status === 301 || plain.status === 308) pass("http:// goes to https://", `${plain.status} permanent`);
    else warn("http:// goes to https://", `works, but ${plain.status} is temporary`, "Optional: use a permanent (301) redirect so search engines drop the http:// address sooner.");
  }

  // 3. The www host reaches the site, and goes to the preferred host.
  if (!host.startsWith("www.")) {
    const www = await get(`https://www.${host}/tools/merge-pdf`);
    const where = www.failed ? "" : (www.headers.get("location") ?? "");
    if (www.failed) fail("www redirects to the apex", www.failed, `Add a DNS record for www.${host} (proxied) and a redirect to https://${host}.`);
    else if ([301, 308].includes(www.status) && where === `${origin}/tools/merge-pdf`) pass("www redirects to the apex", `${www.status}, path kept`);
    else if ([302, 307].includes(www.status) && where.startsWith(origin)) warn("www redirects to the apex", `${www.status} is temporary`, "Use a permanent (301 or 308) redirect so ranking signals move to the apex.");
    else fail("www redirects to the apex", `https://www.${host}/tools/merge-pdf returned ${www.status}${where ? ` to ${where}` : ""}`, `Add www.${host} to the host's domains so the app's own redirect can answer, or add a Cloudflare Redirect Rule: https://www.${host}/* to https://${host}/\${1} (301, keep the query string).`);
  }

  // 4. Security headers, as set by next.config.ts.
  if (html) {
    const problems = cspProblems(home.headers.get("content-security-policy"));
    if (problems.length) fail("Content-Security-Policy is intact", problems.join("; "), "Something in front of the app changed or removed it. The app must be served with the headers in next.config.ts unmodified.");
    else pass("Content-Security-Policy is intact", "own origin only, no outside hosts");
    const others = { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin" };
    const wrong = Object.entries(others).filter(([k, v]) => home.headers.get(k) !== v).map(([k]) => k);
    if (wrong.length) warn("Other security headers", `missing or changed: ${wrong.join(", ")}`, "They come from next.config.ts; check what the proxy rewrites.");
    else pass("Other security headers");

    // 5. Nothing was injected into the page.
    const outside = externalScripts(html, origin);
    if (outside.length) fail("No outside scripts in the page", outside.join(", "), "A proxy is injecting a script (Cloudflare Web Analytics, Rocket Loader, email obfuscation). Turn it off: it breaks the privacy promise and the CSP.");
    else pass("No outside scripts in the page");
  }

  // 5b. The service worker must revalidate so updates roll out.
  const sw = await get(`${origin}/sw.js`);
  if (sw.failed || sw.status !== 200) fail("Service worker is served", sw.failed ?? `GET /sw.js returned ${sw.status}`, "The app serves /sw.js from apps/web/public.");
  else if (/no-cache|max-age=0/.test(sw.headers.get("cache-control") ?? "")) pass("Service worker is not cached", sw.headers.get("cache-control"));
  else warn("Service worker is not cached", `Cache-Control is '${sw.headers.get("cache-control")}'`, "The app sends no-cache but the CDN overrides it. Cloudflare: Caching > Configuration > Browser Cache TTL = 'Respect Existing Headers', and add a Cache Rule to bypass cache for /sw.js.");

  // 6. Crawler files.
  const robots = await get(`${origin}/robots.txt`);
  const robotsText = robots.failed || robots.status !== 200 ? "" : await robots.text();
  if (!robotsText) fail("robots.txt", robots.failed ?? `returned ${robots.status}`, "robots.txt is generated by apps/web/src/app/robots.ts.");
  else if (!robotsText.includes(`Sitemap: ${origin}/sitemap.xml`) || !robotsText.includes("Disallow: /api/")) fail("robots.txt", `missing 'Sitemap: ${origin}/sitemap.xml' or 'Disallow: /api/'`, "Set NEXT_PUBLIC_SITE_URL at build time to the real address and redeploy.");
  else pass("robots.txt", "points to the sitemap, blocks /api/");

  const sitemap = await get(`${origin}/sitemap.xml`);
  const sitemapText = sitemap.failed || sitemap.status !== 200 ? "" : await sitemap.text();
  const locs = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length < 100) fail("sitemap.xml", `${locs.length} URLs`, "The sitemap should list every tool, category, guide and page (130+).");
  else if (locs.some((u) => !u.startsWith(`${origin}/`) && u !== origin)) fail("sitemap.xml", `contains URLs outside ${origin}`, "Set NEXT_PUBLIC_SITE_URL at build time (it is baked in) and redeploy.");
  else pass("sitemap.xml", `${locs.length} URLs, all on ${host}`);

  const llms = await get(`${origin}/llms.txt`);
  if (llms.failed || llms.status !== 200) warn("llms.txt", llms.failed ?? `returned ${llms.status}`, "Generated by apps/web/src/app/llms.txt/route.ts.");
  else pass("llms.txt");

  // 7. Link previews.
  if (html) {
    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
    if (canonical && canonical.replace(/\/$/, "") !== origin) fail("Canonical URL", `the home page says ${canonical}`, "Set NEXT_PUBLIC_SITE_URL at build time and redeploy.");
    const cardUrl = metaContent(html, "og:image");
    if (!cardUrl || !cardUrl.startsWith("https://")) fail("Link-preview card", `og:image is '${cardUrl ?? "missing"}'`, "It must be an absolute https:// URL. WhatsApp and Facebook ignore anything else.");
    else {
      const card = await get(cardUrl);
      const bytes = card.failed || card.status !== 200 ? null : Buffer.from(await card.arrayBuffer());
      const size = bytes ? pngSize(bytes) : null;
      if (!bytes) fail("Link-preview card", `${cardUrl} ${card.failed ?? card.status}`, "The card route must answer 200 to anyone, including WhatsApp's crawler.");
      else if (!size || size.width !== 1200 || size.height !== 630) fail("Link-preview card", `${cardUrl} is not a 1200x630 PNG`, "Check apps/web/src/lib/og-card.tsx.");
      else if (bytes.length > MAX_CARD_BYTES) warn("Link-preview card", `${Math.round(bytes.length / 1024)} KB is over 300 KB`, "WhatsApp may skip images over about 300 KB.");
      else pass("Link-preview card", `1200x630 PNG, ${Math.round(bytes.length / 1024)} KB`);
    }
    const crawler = await get(`${origin}/tools/merge-pdf`, { headers: { "user-agent": "WhatsApp/2.24.10.80 A" } });
    const crawlerHtml = crawler.failed || crawler.status !== 200 ? "" : await crawler.text();
    if (!crawlerHtml.includes('property="og:image"')) fail("Social crawlers see the tags", `a WhatsApp-style request got ${crawler.failed ?? crawler.status}`, "A firewall or bot-protection rule is blocking link-preview crawlers. Allow WhatsApp, facebookexternalhit, Twitterbot, LinkedInBot, TelegramBot, Slackbot and Discordbot (Cloudflare: Security > Bots).");
    else pass("Social crawlers see the tags", "a WhatsApp-style request gets the full page");
  }

  // 8. The request board's database.
  const health = await get(`${origin}/api/health`);
  if (health.failed) fail("Request board health", health.failed, "Check the app is running.");
  else if (health.status === 404) fail("Request board health", "/api/health does not exist on this deployment", "Deploy the latest build.");
  else {
    const body = await health.json().catch(() => null);
    const db = body?.database;
    if (health.status === 200 && db?.persistent) pass("Request board database", "connected, tables present");
    else if (health.status === 200) warn("Request board database", "demo mode: DATABASE_URL is not set, so ideas live in server memory and are lost on restart", "Create a Postgres database, set DATABASE_URL on the server, run the migrations (see docs/maintainers.md), then restart.");
    else fail("Request board database", `health says '${db?.state ?? "unknown"}'`, DATABASE_HINTS[db?.state] ?? DATABASE_HINTS.error);
  }
  const board = await get(`${origin}/api/requests?limit=1`);
  if (board.failed || board.status >= 500) fail("Request board API", board.failed ?? `GET /api/requests returned ${board.status}`, "Fix the database first (see the line above); visitors see the board as unavailable until then.");
  else pass("Request board API", `GET /api/requests returned ${board.status}`);

  // 9. IndexNow.
  const key = findIndexNowKey();
  if (!key) warn("IndexNow key", "no key file in apps/web/public", "Optional (helps Bing and others find new pages faster): node scripts/indexnow.mjs init, deploy, then node scripts/indexnow.mjs submit --send.");
  else {
    const live = await get(`${origin}/${key}.txt`);
    const text = live.failed || live.status !== 200 ? "" : (await live.text()).trim();
    if (text === key) pass("IndexNow key is live");
    else fail("IndexNow key is live", `${origin}/${key}.txt ${live.failed ?? live.status}`, "Deploy the site with the key file in apps/web/public, then submit.");
  }
}

function summarise() {
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n${count("pass")} passed, ${count("warn")} warnings, ${count("fail")} failed`);
  const todo = results.filter((r) => r.status !== "pass");
  if (todo.length) {
    console.log("\nWhat to do:");
    for (const r of todo) console.log(`  ${r.status === "fail" ? "FIX " : "ADVISE"} ${r.name}: ${r.fix}`);
  }
  return count("fail");
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const site = arg ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolwright.com";
  await run(site);
  process.exit(summarise() > 0 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
