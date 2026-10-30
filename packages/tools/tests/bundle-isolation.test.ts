// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PDF.js is about 1.7 MB of JavaScript. It may only be reached through one lazy `import()`, so that no shared
 * bundle, tool chunk or page ever pays for it unless someone runs Compress PDF's "Smallest file" mode.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" || name === ".next" ? [] : walk(full);
    return /\.(tsx?|mjs|css)$/.test(name) ? [full] : [];
  });
}

const FILES = ["apps/web/src", "packages/core/src", "packages/tools/src", "packages/ui/src"].flatMap((d) => walk(join(ROOT, d))).map((file) => ({ rel: relative(ROOT, file).replaceAll("\\", "/"), src: readFileSync(file, "utf8") }));

describe("PDF.js stays out of shared bundles", () => {
  it("is mentioned only by the lazy renderer", () => {
    const mentions = FILES.filter((f) => f.src.includes("pdfjs-dist")).map((f) => f.rel).sort();
    expect(mentions).toEqual(["packages/tools/src/shared/pdf-raster.ts"]);
  });

  it("is loaded with a dynamic import, never a static one", () => {
    const raster = FILES.find((f) => f.rel === "packages/tools/src/shared/pdf-raster.ts")!.src;
    expect(raster).toMatch(/await import\("pdfjs-dist\/build\/pdf\.min\.mjs"\)/);
    expect(raster).not.toMatch(/^\s*import\s[^;(]*from\s+["']pdfjs-dist/m);
  });

  it("keeps the compression module out of the core barrel file", () => {
    const index = FILES.find((f) => f.rel === "packages/core/src/index.ts")!.src;
    expect(index).not.toContain("pdf-compress");
  });

  it("loads Mermaid only from one file, with a dynamic import", () => {
    const importsMermaid = /(?:from\s+|import\(\s*)["']mermaid["']/;
    expect(FILES.filter((f) => importsMermaid.test(f.src)).map((f) => f.rel)).toEqual(["packages/tools/src/shared/mermaid-render.ts"]);
    const render = FILES.find((f) => f.rel === "packages/tools/src/shared/mermaid-render.ts")!.src;
    expect(render).toMatch(/await import\("mermaid"\)/);
    expect(render).not.toMatch(/^\s*import\s[^;(]*from\s+["']mermaid["']/m);
    // The security settings the privacy claim relies on.
    expect(render).toContain('securityLevel: "strict"');
    expect(render).toContain("htmlLabels: false");
  });

  it("keeps the SVG and GIF libraries behind one core file each, and out of the core barrel", () => {
    const only = (needle: RegExp) => FILES.filter((f) => needle.test(f.src)).map((f) => f.rel);
    expect(only(/from\s+["']svgo(\/browser)?["']/)).toEqual(["packages/core/src/svg-optimize.ts"]);
    expect(only(/from\s+["'](gifenc|omggif)["']/)).toEqual(["packages/core/src/gif-tools.ts"]);
    expect(only(/from\s+["']imagetracerjs["']/)).toEqual(["packages/core/src/image-trace.ts"]);
    const index = FILES.find((f) => f.rel === "packages/core/src/index.ts")!.src;
    for (const heavy of ["svg-optimize", "gif-tools", "image-trace"]) expect(index).not.toContain(heavy);
  });

  it("reaches the heavy SVG and GIF modules at run time only from workers", () => {
    // "import type" is erased at build time, so only value imports count.
    const valueImporters = (module: string) => {
      const pattern = new RegExp(`^import\\s+(?!type\\b)[^;]*from\\s+["']@toolwright/core/${module}["']`, "m");
      return FILES.filter((f) => pattern.test(f.src)).map((f) => f.rel);
    };
    expect(valueImporters("svg-optimize")).toEqual(["packages/tools/src/shared/svg-optimize.worker.ts"]);
    expect(valueImporters("gif-tools")).toEqual(["packages/tools/src/shared/gif.worker.ts"]);
    expect(valueImporters("image-trace")).toEqual(["packages/tools/src/shared/image-trace.worker.ts"]);
  });

  it("keeps DOM and network APIs out of the pure compression module", () => {
    const core = FILES.find((f) => f.rel === "packages/core/src/pdf-compress.ts")!.src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    expect(core).not.toMatch(/\b(document|window|fetch|OffscreenCanvas|createImageBitmap|localStorage)\b/);
  });
});
