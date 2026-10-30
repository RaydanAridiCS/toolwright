#!/usr/bin/env node
/**
 * Copies the files PDF.js loads at run time into apps/web/public/pdfjs/, so they are served from this site
 * (the Content Security Policy forbids fetching them from a CDN). Used only by Compress PDF's "Smallest file" mode.
 *
 *   pdf.worker.min.mjs  the PDF.js worker, started as a plain module worker (the bundler cannot wrap it)
 *   cmaps/            character maps for CJK and other predefined encodings (fetched only when a page needs one)
 *   standard_fonts/   fallback fonts for the 14 standard PDF fonts
 *   wasm/             only the *_nowasm_fallback.js decoders (JPEG 2000, JBIG2). The .wasm files are not copied:
 *                     the CSP has no 'wasm-unsafe-eval', so the tool runs PDF.js with `useWasm: false`.
 *
 * The output is generated and git-ignored. Run automatically before `dev` and `build`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "packages", "tools", "package.json"));
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
const target = join(root, "apps", "web", "public", "pdfjs");
const stamp = join(target, ".version");

if (existsSync(stamp) && existsSync(join(target, "pdf.worker.min.mjs")) && readFileSync(stamp, "utf8") === version) {
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, "wasm"), { recursive: true });
cpSync(join(source, "build", "pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs"));
cpSync(join(source, "cmaps"), join(target, "cmaps"), { recursive: true, filter: (file) => !file.endsWith("LICENSE") });
cpSync(join(source, "standard_fonts"), join(target, "standard_fonts"), { recursive: true });
for (const name of readdirSync(join(source, "wasm"))) {
  if (name.endsWith("_nowasm_fallback.js") && !name.startsWith("quickjs")) cpSync(join(source, "wasm", name), join(target, "wasm", name));
}
writeFileSync(stamp, version);
console.log(`pdfjs-dist ${version}: assets copied to apps/web/public/pdfjs`);
