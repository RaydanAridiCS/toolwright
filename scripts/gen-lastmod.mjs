#!/usr/bin/env node
/**
 * Writes apps/web/src/lib/lastmod.generated.json: the date each page's source last changed, for sitemap.xml.
 *
 *   tools  slug -> date of the last commit that touched packages/tools/src/tools/<slug>/
 *   pages  path -> date of the last commit that touched that page's file
 *
 * A path with uncommitted changes gets today's date, because it did change today. Dates are YYYY-MM-DD.
 * Without a git checkout (a Docker build, a source tarball) the script leaves the committed file alone.
 * Run it by hand before a release (`node scripts/gen-lastmod.mjs`); it is also run by `prebuild` when git is available.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/web/src/lib/lastmod.generated.json");
const toolsDir = "packages/tools/src/tools";

const PAGES = {
  "/": "apps/web/src/app/page.tsx",
  "/tools": "apps/web/src/app/tools/page.tsx",
  "/about": "apps/web/src/app/about/page.tsx",
  "/privacy": "apps/web/src/app/privacy/page.tsx",
  "/contribute": "apps/web/src/app/contribute/page.tsx",
  "/requests": "apps/web/src/app/requests/page.tsx",
};

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function lastChanged(path) {
  if (git(["status", "--porcelain", "--", path])) return new Date().toISOString().slice(0, 10);
  return git(["log", "-1", "--format=%cs", "--", path]) || new Date().toISOString().slice(0, 10);
}

try {
  git(["rev-parse", "--git-dir"]);
} catch {
  console.log("gen-lastmod: not a git checkout, keeping the committed file");
  process.exit(0);
}

const tools = {};
for (const slug of readdirSync(join(root, toolsDir)).sort()) tools[slug] = lastChanged(`${toolsDir}/${slug}`);
const pages = {};
for (const [path, file] of Object.entries(PAGES)) pages[path] = lastChanged(file);

const content = JSON.stringify({ tools, pages }, null, 2) + "\n";
const current = existsSync(out) ? readFileSync(out, "utf8") : "";
if (current !== content) writeFileSync(out, content);
console.log(`gen-lastmod: ${Object.keys(tools).length} tools, ${Object.keys(pages).length} pages${current === content ? " (unchanged)" : ""}`);
