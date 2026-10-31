import { describe, expect, it } from "vitest";
import { CATEGORIES, getTool, tools } from "../src";

/**
 * The search-facing copy of every tool: one primary query each, a unique title and description, an answer-first
 * summary, and FAQ and steps for every page. Lengths are the bands search engines show without cutting.
 */

const BRAND = /toolwright/i;
const BANNED = /gradient|blur|glow|backdrop-/i;
const INVENTED = /aggregaterating|ratingvalue|trusted by|millions of (users|people)|#1\b|number one|guaranteed? (to )?rank/i;
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

describe("SEO fields", () => {
  it("every tool has all four SEO fields", () => {
    for (const t of tools) {
      expect(t.primaryKeyword, `${t.slug} primaryKeyword`).toBeTruthy();
      expect(t.seoTitle, `${t.slug} seoTitle`).toBeTruthy();
      expect(t.seoDescription, `${t.slug} seoDescription`).toBeTruthy();
      expect(t.answer, `${t.slug} answer`).toBeTruthy();
    }
  });

  it.each(tools.map((t) => [t.slug, t] as const))("%s: title, description and answer are within their bands", (slug, t) => {
    const title = t.seoTitle ?? "";
    // The page adds " | Toolwright" (13 characters), so 47 keeps the full title at 60 or less.
    expect(title.length, `${slug} title length ${title.length}`).toBeGreaterThanOrEqual(25);
    expect(title.length, `${slug} title length ${title.length}`).toBeLessThanOrEqual(47);
    expect(title, `${slug} title repeats the brand`).not.toMatch(BRAND);
    expect(title.toLowerCase(), `${slug} title lacks the primary keyword`).toContain(t.primaryKeyword);

    const desc = t.seoDescription ?? "";
    expect(desc.length, `${slug} description length ${desc.length}`).toBeGreaterThanOrEqual(110);
    expect(desc.length, `${slug} description length ${desc.length}`).toBeLessThanOrEqual(160);
    expect(desc, `${slug} description repeats the brand`).not.toMatch(BRAND);

    const answer = t.answer ?? "";
    expect(answer.length, `${slug} answer length ${answer.length}`).toBeGreaterThanOrEqual(80);
    expect(answer.length, `${slug} answer length ${answer.length}`).toBeLessThanOrEqual(320);
    const answerWords = new Set(words(`${t.name} ${answer}`));
    for (const w of words(t.primaryKeyword ?? "")) expect(answerWords.has(w), `${slug} answer lacks "${w}"`).toBe(true);
  });

  it("primary keywords are lower case, short and unique (one query per page)", () => {
    const seen = new Map<string, string>();
    for (const t of tools) {
      const k = t.primaryKeyword ?? "";
      expect(k, t.slug).toBe(k.toLowerCase().trim());
      expect(words(k).length, `${t.slug} keyword "${k}"`).toBeGreaterThanOrEqual(1);
      expect(words(k).length, `${t.slug} keyword "${k}"`).toBeLessThanOrEqual(6);
      expect(seen.has(k), `"${k}" is the primary keyword of both ${seen.get(k)} and ${t.slug}`).toBe(false);
      seen.set(k, t.slug);
    }
  });

  it("titles and descriptions are unique", () => {
    const titles = tools.map((t) => (t.seoTitle ?? "").toLowerCase());
    const descriptions = tools.map((t) => (t.seoDescription ?? "").toLowerCase());
    expect(new Set(titles).size).toBe(tools.length);
    expect(new Set(descriptions).size).toBe(tools.length);
  });

  it("a page's keyword does not appear in another page's title as its own first words", () => {
    // Two pages starting with the same phrase would compete for the same query.
    const starts = tools.map((t) => (t.seoTitle ?? "").toLowerCase().split(/[:,]/)[0]!.trim());
    const dupes = starts.filter((s, i) => starts.indexOf(s) !== i);
    expect(dupes).toEqual([]);
  });

  it("file tools say the work is local in their search description", () => {
    for (const t of tools.filter((x) => x.category === "pdf" || x.category === "image")) {
      expect(/upload|browser|device|private|local/i.test(t.seoDescription ?? ""), t.slug).toBe(true);
    }
  });

  it("every tool has a how-to and at least one FAQ", () => {
    for (const t of tools) {
      expect(t.howTo?.length ?? 0, `${t.slug} howTo`).toBeGreaterThanOrEqual(3);
      expect(t.faq?.length ?? 0, `${t.slug} faq`).toBeGreaterThanOrEqual(1);
      const questions = (t.faq ?? []).map((f) => f.question.toLowerCase());
      expect(new Set(questions).size, `${t.slug} repeats a question`).toBe(questions.length);
      for (const f of t.faq ?? []) {
        expect(f.question.endsWith("?")).toBe(true);
        expect(f.answer.length, `${t.slug}: ${f.question}`).toBeLessThanOrEqual(600);
      }
    }
  });

  it("next steps point at a real, different tool with a descriptive sentence", () => {
    for (const t of tools) {
      if (!t.nextStep) continue;
      expect(getTool(t.nextStep.slug), `${t.slug} nextStep`).toBeDefined();
      expect(t.nextStep.slug).not.toBe(t.slug);
      expect(t.nextStep.text.length).toBeGreaterThanOrEqual(15);
      expect(t.nextStep.text.length).toBeLessThanOrEqual(120);
    }
  });

  it("popular tools all have a next step", () => {
    expect(tools.filter((t) => t.popular && !t.nextStep).map((t) => t.slug)).toEqual([]);
  });

  it("uses no banned design words, no self-hosting copy and no invented ratings in any SEO copy", () => {
    for (const t of tools) {
      const text = JSON.stringify({ ...t, icon: undefined });
      expect(text, `${t.slug} design words`).not.toMatch(BANNED);
      expect(text, `${t.slug} invented claims`).not.toMatch(INVENTED);
      expect(text, `${t.slug} self-host`).not.toMatch(/self[- ]?host/i);
    }
  });

  it("every category has tools to describe", () => {
    for (const c of CATEGORIES) expect(tools.some((t) => t.category === c.id)).toBe(true);
  });
});

describe("category landing copy", () => {
  it.each(CATEGORIES.map((c) => [c.id] as const))("%s has a titled, described, 100 to 200 word intro", async (id) => {
    const { CATEGORY_CONTENT } = await import("../src");
    const c = CATEGORY_CONTENT[id];
    expect(c.seoTitle.length).toBeGreaterThanOrEqual(25);
    expect(c.seoTitle.length).toBeLessThanOrEqual(47);
    expect(c.seoTitle).not.toMatch(BRAND);
    expect(c.seoDescription.length).toBeGreaterThanOrEqual(110);
    expect(c.seoDescription.length).toBeLessThanOrEqual(160);
    const count = words(c.intro.join(" ")).length;
    expect(count, `${id} intro has ${count} words`).toBeGreaterThanOrEqual(100);
    expect(count, `${id} intro has ${count} words`).toBeLessThanOrEqual(200);
    expect(JSON.stringify(c)).not.toMatch(BANNED);
    expect(JSON.stringify(c)).not.toMatch(INVENTED);
    expect(JSON.stringify(c)).not.toMatch(/self[- ]?host/i);
  });
  it("titles and descriptions are unique across categories", async () => {
    const { CATEGORY_CONTENT } = await import("../src");
    const all = Object.values(CATEGORY_CONTENT);
    expect(new Set(all.map((c) => c.seoTitle)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.seoDescription)).size).toBe(all.length);
  });
});
