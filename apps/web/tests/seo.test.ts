/* eslint-disable @typescript-eslint/no-explicit-any -- the tests read arbitrary parsed JSON-LD */
import { describe, expect, it } from "vitest";
import { CATEGORIES, getTool, tools, toolsByCategory } from "@toolwright/tools";
import { GUIDES } from "../src/content/guides";
import { DISALLOWED_PATHS, SEARCH_AND_ANSWER_CRAWLERS, TRAINING_CRAWLERS, allowTrainingCrawlers } from "../src/lib/crawler-policy";
import { HOME_FAQ } from "../src/lib/home-faq";
import { buildLlmsFullTxt, buildLlmsTxt } from "../src/lib/llms";
import { pageMetadata } from "../src/lib/seo";
import { SITE, absoluteUrl } from "../src/lib/site";
import { articleLd, breadcrumbLd, categoryLd, faqLd, howToLd, organizationLd, toolLd, websiteLd } from "../src/lib/structured-data";

const BANNED = /gradient|blur|glow|backdrop-/i;
const INVENTED = /aggregaterating|ratingvalue|reviewcount|trusted by|millions of (users|people)|#1\b|guaranteed? (to )?rank/i;
const roundTrip = (data: unknown) => JSON.parse(JSON.stringify(data)) as Record<string, any>;

describe("site metadata", () => {
  it("the home title and description fit a results page", () => {
    expect(SITE.homeTitle.length).toBeLessThanOrEqual(60);
    expect(SITE.homeTitle.endsWith(SITE.name)).toBe(true);
    expect(SITE.metaDescription.length).toBeGreaterThanOrEqual(110);
    expect(SITE.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("no site-wide copy still quotes a stale tool count", () => {
    expect(`${SITE.description} ${SITE.metaDescription} ${SITE.homeTitle}`).not.toMatch(/\d+\+? (online |free )?tools/);
  });

  it("pageMetadata gives each page its own canonical URL, card text and image alt", () => {
    const m = pageMetadata({ title: "About Toolwright", description: "A description long enough to be useful here.", path: "/about", image: { path: "/x/opengraph-image", alt: "About card" } });
    expect(m.alternates?.canonical).toBe("/about");
    expect((m.openGraph as any).url).toBe(absoluteUrl("/about"));
    expect((m.openGraph as any).title).toBe("About Toolwright | Toolwright");
    expect((m.openGraph as any).images[0]).toMatchObject({ url: absoluteUrl("/x/opengraph-image"), width: 1200, height: 630, alt: "About card" });
    expect((m.twitter as any).images[0].alt).toBe("About card");
    expect(pageMetadata({ title: "t", description: "d", path: "/", noindex: true }).robots).toMatchObject({ index: false });
  });
});

describe("structured data", () => {
  it.each(tools.map((t) => [t.slug, t] as const))("%s: WebApplication has what Google and answer engines read", (_slug, tool) => {
    const ld = roundTrip(toolLd(tool));
    expect(ld["@type"]).toBe("WebApplication");
    expect(ld.name).toBe(tool.name);
    expect(ld.url).toBe(absoluteUrl(`/tools/${tool.slug}`));
    expect(ld.description).toBe(tool.seoDescription);
    expect(ld.applicationCategory).toMatch(/Application$/);
    expect(ld.operatingSystem).toBe("Any");
    expect(ld.isAccessibleForFree).toBe(true);
    expect(ld.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    expect(ld.browserRequirements).toBeTruthy();
    expect(ld.featureList.length).toBeGreaterThanOrEqual(3);
    expect(ld.publisher).toMatchObject({ "@type": "Organization", "@id": `${SITE.url}/#organization`, name: "Toolwright" });
    expect(JSON.stringify(ld)).not.toMatch(INVENTED);
  });

  it("FAQPage and HowTo match the visible text exactly", () => {
    for (const tool of tools) {
      const faq = roundTrip(faqLd(tool.faq ?? []));
      expect(faq.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual((tool.faq ?? []).map((f) => [f.question, f.answer]));
      const how = roundTrip(howToLd(`How to use ${tool.name}`, tool.howTo ?? []));
      expect(how.step.map((s: any) => s.text)).toEqual(tool.howTo ?? []);
      expect(how.step.map((s: any) => s.position)).toEqual((tool.howTo ?? []).map((_, i) => i + 1));
    }
  });

  it("breadcrumbs use absolute URLs and run from the home page", () => {
    const ld = roundTrip(breadcrumbLd([{ name: "Home", path: "/" }, { name: "PDF", path: "/category/pdf" }]));
    expect(ld.itemListElement.map((i: any) => i.item)).toEqual([absoluteUrl("/"), absoluteUrl("/category/pdf")]);
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });

  it("category pages list every tool of the drawer in an ItemList", () => {
    for (const c of CATEGORIES) {
      const list = toolsByCategory(c.id);
      const ld = roundTrip(categoryLd(c, list));
      expect(ld.mainEntity.numberOfItems).toBe(list.length);
      expect(ld.mainEntity.itemListElement.map((i: any) => i.url)).toEqual(list.map((t) => absoluteUrl(`/tools/${t.slug}`)));
    }
  });

  it("the home page carries an Organization with the repository and a WebSite with a real search URL", () => {
    const org = roundTrip(organizationLd());
    expect(org.sameAs).toContain(SITE.repo);
    expect(org["@id"]).toBe(`${SITE.url}/#organization`);
    const site = roundTrip(websiteLd());
    expect(site.potentialAction.target).toBe(`${absoluteUrl("/tools")}?q={search_term_string}`);
    expect(JSON.stringify([org, site])).not.toMatch(INVENTED);
  });

  it("the home FAQ is valid and honest", () => {
    for (const f of HOME_FAQ) {
      expect(f.question.endsWith("?")).toBe(true);
      expect(f.answer.length).toBeGreaterThan(40);
    }
    expect(JSON.stringify(HOME_FAQ)).not.toMatch(/self[- ]?host|gradient|blur|glow|backdrop-/i);
  });
});

describe("guides", () => {
  it("have unique slugs, titles and descriptions inside the length bands", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((g) => g.seoTitle)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.slug, g.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(g.seoTitle.length, g.slug).toBeGreaterThanOrEqual(25);
      expect(g.seoTitle.length, g.slug).toBeLessThanOrEqual(47);
      expect(g.seoTitle, g.slug).not.toMatch(/toolwright/i);
      expect(g.seoDescription.length, `${g.slug} description ${g.seoDescription.length}`).toBeGreaterThanOrEqual(110);
      expect(g.seoDescription.length, `${g.slug} description ${g.seoDescription.length}`).toBeLessThanOrEqual(160);
      expect(g.answer.length, g.slug).toBeGreaterThanOrEqual(150);
    }
  });

  it("carry true dates, real tools and real content", () => {
    for (const g of GUIDES) {
      expect(g.published, g.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(g.updated >= g.published, g.slug).toBe(true);
      expect(new Date(`${g.updated}T00:00:00Z`).getTime(), g.slug).toBeLessThanOrEqual(Date.now() + 86_400_000);
      expect(g.tools.length).toBeGreaterThanOrEqual(1);
      for (const slug of g.tools) expect(getTool(slug), `${g.slug} -> ${slug}`).toBeDefined();
      const toolBlocks = g.sections.flatMap((s) => s.blocks).filter((b) => b.type === "tool");
      expect(toolBlocks.length, `${g.slug} links to a tool`).toBeGreaterThanOrEqual(1);
      for (const b of toolBlocks) expect(g.tools).toContain((b as { slug: string }).slug);
      const words = JSON.stringify(g.sections).split(/\s+/).length;
      expect(words, `${g.slug} has ${words} words`).toBeGreaterThanOrEqual(350);
      expect(g.sections.length).toBeGreaterThanOrEqual(3);
      expect(g.faq.length).toBeGreaterThanOrEqual(2);
      for (const f of g.faq) expect(f.question.endsWith("?")).toBe(true);
    }
  });

  it("use no banned design words, self-hosting copy or invented claims", () => {
    for (const g of GUIDES) {
      const text = JSON.stringify(g);
      expect(text, g.slug).not.toMatch(BANNED);
      expect(text, g.slug).not.toMatch(INVENTED);
      expect(text, g.slug).not.toMatch(/self[- ]?host/i);
    }
  });

  it("Article markup carries the real dates and an Organization author", () => {
    for (const g of GUIDES) {
      const ld = roundTrip(articleLd({ title: g.h1, description: g.seoDescription, path: `/guides/${g.slug}`, published: g.published, updated: g.updated }));
      expect(ld["@type"]).toBe("Article");
      expect(ld.datePublished).toBe(g.published);
      expect(ld.dateModified).toBe(g.updated);
      expect(ld.author).toMatchObject({ "@type": "Organization", "@id": `${SITE.url}/#organization`, name: "Toolwright" });
    }
  });
});

describe("crawler policy", () => {
  it("always allows search and answer crawlers, and names the training crawlers", () => {
    for (const bot of ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "PerplexityBot"]) expect(SEARCH_AND_ANSWER_CRAWLERS).toContain(bot);
    for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"]) expect(TRAINING_CRAWLERS).toContain(bot);
    expect(DISALLOWED_PATHS).toContain("/api/");
  });

  it("allows training crawlers by default and blocks them with TOOLWRIGHT_AI_TRAINING=block", () => {
    expect(allowTrainingCrawlers({})).toBe(true);
    expect(allowTrainingCrawlers({ TOOLWRIGHT_AI_TRAINING: "allow" })).toBe(true);
    expect(allowTrainingCrawlers({ TOOLWRIGHT_AI_TRAINING: "block" })).toBe(false);
    expect(allowTrainingCrawlers({ TOOLWRIGHT_AI_TRAINING: "BLOCK" })).toBe(false);
  });

  it("robots.txt repeats the API block in every named group and lists the sitemap", async () => {
    const robots = (await import("../src/app/robots")).default();
    const rules = robots.rules as { userAgent: string; allow?: string; disallow?: string | string[] }[];
    const byAgent = new Map(rules.map((r) => [r.userAgent, r]));
    for (const bot of [...SEARCH_AND_ANSWER_CRAWLERS, ...TRAINING_CRAWLERS]) expect(byAgent.has(bot), bot).toBe(true);
    for (const bot of SEARCH_AND_ANSWER_CRAWLERS) expect(byAgent.get(bot)!.disallow).toContain("/api/");
    expect(robots.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });
});

describe("llms.txt", () => {
  const short = buildLlmsTxt();
  const full = buildLlmsFullTxt();

  it("is a Markdown index with the title, a summary, every category and the full file", () => {
    expect(short.startsWith("# Toolwright\n")).toBe(true);
    expect(short).toContain("\n> ");
    for (const c of CATEGORIES) expect(short).toContain(absoluteUrl(`/category/${c.id}`));
    expect(short).toContain(absoluteUrl("/llms-full.txt"));
    for (const g of GUIDES) expect(short).toContain(absoluteUrl(`/guides/${g.slug}`));
  });

  it("the full file lists every tool with its answer", () => {
    for (const t of tools) {
      expect(full, t.slug).toContain(absoluteUrl(`/tools/${t.slug}`));
      expect(full, t.slug).toContain(t.answer ?? t.description);
    }
  });

  it("states only true, non-promotional things", () => {
    for (const text of [short, full]) {
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(INVENTED);
      expect(text).not.toMatch(/self[- ]?host/i);
    }
    expect(short).toContain(`${tools.length} online tools`);
  });
});
