import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations
import { DATABASE_HINTS, cspProblems, externalScripts, findIndexNowKey, metaContent, pngSize } from "../../../scripts/check-deploy.mjs";
// The same policy the site sends, so this test fails if next.config.ts and the deploy check drift apart.
import config from "../next.config";

describe("deploy check helpers", () => {
  it("reads a meta tag by property or name, in any attribute order", () => {
    const html = `<meta property="og:image" content="https://toolwright.com/a?x=1&amp;y=2"/><meta content="summary_large_image" name="twitter:card"/>`;
    expect(metaContent(html, "og:image")).toBe("https://toolwright.com/a?x=1&y=2");
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
    expect(metaContent(html, "og:title")).toBeUndefined();
  });

  it("reads the size of a PNG and rejects anything else", () => {
    const png = Buffer.alloc(33);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png);
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(630, 20);
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
    expect(pngSize(Buffer.from("<html></html> and some more bytes here"))).toBeNull();
    expect(pngSize(Buffer.alloc(4))).toBeNull();
  });

  it("finds scripts that do not come from the site, including ones a proxy injects", () => {
    const html = `<script src="/_next/static/a.js"></script><script src="https://toolwright.com/_next/b.js"></script>
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script><script src="/cdn-cgi/scripts/x.js"></script><script>inline()</script>`;
    expect(externalScripts(html, "https://toolwright.com")).toEqual(["https://static.cloudflareinsights.com/beacon.min.js", "/cdn-cgi/scripts/x.js"]);
    expect(externalScripts(`<script src="/_next/a.js"></script>`, "https://toolwright.com")).toEqual([]);
  });

  it("accepts the policy the site really sends, and flags one that was loosened", async () => {
    const headers = await config.headers!();
    const csp = headers.find((h) => h.source === "/:path*")!.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(cspProblems(csp)).toEqual([]);
    expect(cspProblems(csp.replace("connect-src 'self'", "connect-src 'self' https://analytics.example"))).not.toEqual([]);
    expect(cspProblems(`${csp}; script-src 'wasm-unsafe-eval'`)).toContain("the policy allows wasm-unsafe-eval");
    expect(cspProblems(null)).toEqual(["there is no Content-Security-Policy header"]);
  });

  it("has advice for every database state /api/health can report", () => {
    expect(Object.keys(DATABASE_HINTS).sort()).toEqual(["error", "not_migrated", "rejected", "unreachable"]);
    for (const hint of Object.values(DATABASE_HINTS) as string[]) expect(hint.length).toBeGreaterThan(40);
  });

  it("finds the IndexNow key only when there is exactly one", () => {
    expect(findIndexNowKey("/definitely/not/a/folder")).toBeNull();
  });
});
