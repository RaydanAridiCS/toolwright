#!/usr/bin/env node
/**
 * IndexNow: tell Bing and the other IndexNow search engines that pages changed, so they crawl them sooner.
 * This runs on the maintainer's machine. It is never called from the site and never runs in a visitor's browser.
 *
 *   node scripts/indexnow.mjs init                    make a key and write apps/web/public/<key>.txt (deploy it, then submit)
 *   node scripts/indexnow.mjs submit                  show the URLs it would send (a dry run)
 *   node scripts/indexnow.mjs submit --send           send every URL in the live sitemap
 *   node scripts/indexnow.mjs submit --send --since 2026-10-31
 *                                                     only URLs whose sitemap lastmod is on or after that date
 *
 * Needs the key file to be live at https://<host>/<key>.txt before --send, because the search engine fetches it to
 * check that you own the site. Google does not use IndexNow; use Search Console for Google.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "apps/web/public");
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolwright.com").replace(/\/$/, "");

/** The key is the name of the one 32-character hex .txt file in public/. */
export function findKey(dir = publicDir) {
  const keys = readdirSync(dir).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  return keys.length === 1 ? keys[0].replace(/\.txt$/, "") : null;
}

/** Entries of a sitemap.xml as { url, lastmod } (lastmod may be undefined). */
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    url: /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1],
    lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1],
  }));
}

/** The IndexNow request body. `since` keeps only entries changed on or after a YYYY-MM-DD date. */
export function buildPayload({ host, key, entries, since }) {
  const urlList = entries.filter((e) => e.url && (!since || (e.lastmod && e.lastmod.slice(0, 10) >= since))).map((e) => e.url);
  return { host, key, keyLocation: `https://${host}/${key}.txt`, urlList };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "init") {
    if (findKey()) return console.log(`A key already exists: ${findKey()}.txt`);
    const key = randomBytes(16).toString("hex");
    writeFileSync(join(publicDir, `${key}.txt`), key);
    return console.log(`Wrote apps/web/public/${key}.txt. Deploy the site so https://${new URL(SITE).host}/${key}.txt is live, then run: node scripts/indexnow.mjs submit --send`);
  }
  if (command !== "submit") {
    console.error("Usage: node scripts/indexnow.mjs init | submit [--send] [--since YYYY-MM-DD]");
    process.exit(1);
  }
  const key = findKey();
  if (!key) {
    console.error("No key file in apps/web/public. Run: node scripts/indexnow.mjs init");
    process.exit(1);
  }
  const sinceAt = rest.indexOf("--since");
  const since = sinceAt >= 0 ? rest[sinceAt + 1] : undefined;
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const payload = buildPayload({ host: new URL(SITE).host, key, entries: parseSitemap(xml), since });
  console.log(`${payload.urlList.length} URL(s) from ${SITE}/sitemap.xml${since ? ` changed since ${since}` : ""}`);
  if (!rest.includes("--send")) return console.log("Dry run. Add --send to submit.");
  if (payload.urlList.length === 0) return console.log("Nothing to send.");
  const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) });
  console.log(`IndexNow answered ${res.status} ${res.statusText} (200 or 202 means accepted).`);
  if (res.status >= 400) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
