import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTool, tools } from "../src";
import { KEYWORD_MAP, SERP_CLUSTERS } from "../src/seo/keyword-map";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TIERS = ["low", "medium", "high", "very-high"];

describe("keyword map", () => {
  it("covers every tool and nothing else", () => {
    expect(Object.keys(KEYWORD_MAP).sort()).toEqual(tools.map((t) => t.slug).sort());
  });

  it.each(tools.map((t) => [t.slug] as const))("%s: primary matches the tool, and the entry is complete", (slug) => {
    const e = KEYWORD_MAP[slug]!;
    expect(e.primary).toBe(getTool(slug)!.primaryKeyword);
    expect(["do", "learn", "look-up"]).toContain(e.intent);
    expect(TIERS).toContain(e.volume);
    expect(TIERS).toContain(e.difficulty);
    expect(Object.keys(SERP_CLUSTERS)).toContain(e.serp);
    expect(e.secondary.length, `${slug} secondary`).toBeGreaterThanOrEqual(5);
    expect(e.secondary.length, `${slug} secondary`).toBeLessThanOrEqual(15);
    expect(new Set(e.secondary).size).toBe(e.secondary.length);
    expect(e.secondary, `${slug} lists its own primary as secondary`).not.toContain(e.primary);
    expect(e.modifiers.length).toBeGreaterThanOrEqual(1);
    expect(e.edge.length).toBeGreaterThan(20);
  });

  it("no tool lists another tool's primary query as a secondary one (no cannibalisation)", () => {
    const owner = new Map(Object.entries(KEYWORD_MAP).map(([slug, e]) => [e.primary, slug]));
    for (const [slug, e] of Object.entries(KEYWORD_MAP)) {
      for (const s of e.secondary) expect(owner.has(s) ? `${s} is the primary query of ${owner.get(s)}` : "ok", `${slug}`).toBe("ok");
    }
  });

  it("states that the numbers are estimates", () => {
    const source = readFileSync(join(root, "packages/tools/src/seo/keyword-map.ts"), "utf8");
    expect(source).toMatch(/none of these numbers or lists is measured/i);
  });

  it("makes no claim a page could not honour", () => {
    const text = JSON.stringify(KEYWORD_MAP);
    expect(text).not.toMatch(/gradient|blur|glow|backdrop-|self[- ]?host|rank #?1\b|guaranteed/i);
  });
});
