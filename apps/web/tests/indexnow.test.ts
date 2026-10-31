import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations
import { buildPayload, parseSitemap } from "../../../scripts/indexnow.mjs";

const xml = `<urlset><url><loc>https://toolwright.com/</loc><lastmod>2026-10-30</lastmod></url><url><loc>https://toolwright.com/tools/merge-pdf</loc><lastmod>2026-10-31</lastmod></url><url><loc>https://toolwright.com/requests</loc></url></urlset>`;

describe("IndexNow script", () => {
  it("reads a sitemap, with or without lastmod", () => {
    expect(parseSitemap(xml)).toEqual([
      { url: "https://toolwright.com/", lastmod: "2026-10-30" },
      { url: "https://toolwright.com/tools/merge-pdf", lastmod: "2026-10-31" },
      { url: "https://toolwright.com/requests", lastmod: undefined },
    ]);
  });

  it("builds the request body with the key location on the same host", () => {
    const body = buildPayload({ host: "toolwright.com", key: "a".repeat(32), entries: parseSitemap(xml) });
    expect(body.keyLocation).toBe(`https://toolwright.com/${"a".repeat(32)}.txt`);
    expect(body.urlList).toHaveLength(3);
  });

  it("can send only what changed since a date", () => {
    const body = buildPayload({ host: "toolwright.com", key: "b".repeat(32), entries: parseSitemap(xml), since: "2026-10-31" });
    expect(body.urlList).toEqual(["https://toolwright.com/tools/merge-pdf"]);
  });
});
