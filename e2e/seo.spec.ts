/* eslint-disable @typescript-eslint/no-explicit-any -- the tests read arbitrary parsed JSON-LD */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { trackRequests } from "./helpers";

/**
 * SEO and answer-engine checks against the production build. Every page here is fetched as raw HTML with
 * `request.get`, so no JavaScript runs: what the test sees is what a crawler that does not render JavaScript sees.
 */

const ORIGIN = "https://toolwright.com";
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

async function html(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  return res.text();
}

function head(page: string) {
  const first = (re: RegExp) => decode(re.exec(page)?.[1] ?? "");
  return {
    title: first(/<title>([^<]*)<\/title>/),
    description: first(/<meta name="description" content="([^"]*)"/),
    canonical: first(/<link rel="canonical" href="([^"]*)"/),
    robots: first(/<meta name="robots" content="([^"]*)"/),
    ogTitle: first(/<meta property="og:title" content="([^"]*)"/),
    ogImage: first(/<meta property="og:image" content="([^"]*)"/),
    ogImageAlt: first(/<meta property="og:image:alt" content="([^"]*)"/),
    twitterImage: first(/<meta name="twitter:image" content="([^"]*)"/),
    h1s: [...page.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1]!)),
  };
}

function jsonLd(page: string): Record<string, any>[] {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1]!.replace(/\\u003c/g, "<"))].flat());
}

const TOOL_SAMPLE = ["compress-pdf", "merge-pdf", "pdf-to-images", "image-compressor", "json-formatter", "subnet-calculator", "jwt-decoder", "qr-code-generator"];

test.describe("tool pages without JavaScript", () => {
  for (const slug of TOOL_SAMPLE) {
    test(`/tools/${slug} has its title, description, canonical, H1, answer, FAQ and JSON-LD in the HTML`, async ({ request }) => {
      const page = await html(request, `/tools/${slug}`);
      const h = head(page);
      expect(h.title.endsWith(" | Toolwright"), h.title).toBe(true);
      expect(h.title.length, h.title).toBeLessThanOrEqual(60);
      expect(h.title.match(/Toolwright/g)).toHaveLength(1);
      expect(h.description.length).toBeGreaterThanOrEqual(110);
      expect(h.description.length).toBeLessThanOrEqual(160);
      expect(h.canonical).toBe(`${ORIGIN}/tools/${slug}`);
      expect(h.robots).toContain("index");
      expect(h.h1s).toHaveLength(1);
      expect(h.ogTitle).toBe(h.title);
      expect(h.ogImage).toBe(`${ORIGIN}/tools/${slug}/opengraph-image`);
      expect(h.ogImageAlt).toContain(h.h1s[0]);
      expect(h.twitterImage).toBe(h.ogImage);

      // The answer summary is the first paragraph after the H1, in the static HTML.
      const afterH1 = page.slice(page.indexOf("</h1>"));
      const answer = strip(/<p[^>]*>([\s\S]*?)<\/p>/.exec(afterH1)![1]!);
      expect(answer.length).toBeGreaterThanOrEqual(80);
      expect(answer.length).toBeLessThanOrEqual(320);

      const ld = jsonLd(page);
      const byType = (t: string) => ld.find((x) => x["@type"] === t);
      const app = byType("WebApplication")!;
      expect(app).toMatchObject({ name: h.h1s[0], url: h.canonical, operatingSystem: "Any", isAccessibleForFree: true, offers: { price: "0", priceCurrency: "USD" } });
      expect(app.description).toBe(h.description);
      expect(app.featureList.length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|ratingValue|review/i);

      // The FAQ and the how-to in the markup are the same ones the JSON-LD describes.
      const faq = byType("FAQPage")!;
      const questions = faq.mainEntity.map((q: any) => q.name as string);
      for (const q of questions) expect(strip(page), q).toContain(q);
      const how = byType("HowTo")!;
      for (const step of how.step) expect(strip(page), step.text).toContain(step.text);
      const crumbs = byType("BreadcrumbList")!;
      expect(crumbs.itemListElement.map((i: any) => i.item)).toEqual([`${ORIGIN}/`, expect.stringMatching(/\/category\//), h.canonical]);
      expect(page).toContain('aria-label="Breadcrumb"');
    });
  }

  test("every tool page in the sitemap answers 200 with one H1 and a self-canonical", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeGreaterThanOrEqual(125);
    for (const url of urls) {
      const path = url.replace(ORIGIN, "") || "/";
      const page = await html(request, path);
      const h = head(page);
      expect(h.canonical.replace(/\/$/, ""), path).toBe(url.replace(/\/$/, ""));
      expect(h.h1s.length, `${path} H1s`).toBe(1);
      expect(h.description.length, `${path} description`).toBeGreaterThan(60);
      expect(h.robots, path).not.toContain("noindex");
    }
  });
});

test.describe("category, catalogue and guide pages without JavaScript", () => {
  test("a category page has its own H1, a unique intro and a link to every tool in the drawer", async ({ request }) => {
    const page = await html(request, "/category/pdf");
    const h = head(page);
    expect(h.title).toBe("Free PDF Tools: Merge, Split, Compress, Sign | Toolwright");
    expect(h.h1s).toEqual(["Free PDF tools that run in your browser"]);
    expect(strip(page)).toContain("nothing is uploaded");
    const links = new Set([...page.matchAll(/href="\/tools\/([a-z0-9-]+)"/g)].map((m) => m[1]));
    const ld = jsonLd(page);
    const listed = ld.find((x) => x["@type"] === "CollectionPage")!.mainEntity.numberOfItems;
    expect(listed).toBeGreaterThanOrEqual(10);
    expect(links.size).toBe(listed);
    expect(ld.some((x) => x["@type"] === "BreadcrumbList")).toBe(true);
  });

  test("/tools lists every tool in the HTML, not only after JavaScript runs", async ({ request }) => {
    const page = await html(request, "/tools");
    const links = new Set([...page.matchAll(/href="\/tools\/([a-z0-9-]+)"/g)].map((m) => m[1]));
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const inSitemap = new Set([...sitemap.matchAll(/<loc>[^<]*[/]tools[/]([a-z0-9-]+)<[/]loc>/g)].map((m) => m[1]));
    expect(links.size).toBeGreaterThanOrEqual(110);
    expect(links).toEqual(inSitemap);
    expect(head(page).h1s).toEqual([`All ${links.size} tools`]);
  });

  test("the home page has an Organization, a WebSite and a visible FAQ that matches its FAQPage", async ({ request }) => {
    const page = await html(request, "/");
    const ld = jsonLd(page);
    expect(ld.find((x) => x["@type"] === "Organization")!.sameAs).toEqual(expect.arrayContaining([expect.stringContaining("github.com")]));
    expect(ld.find((x) => x["@type"] === "WebSite")!.potentialAction["@type"]).toBe("SearchAction");
    for (const q of ld.find((x) => x["@type"] === "FAQPage")!.mainEntity) expect(strip(page)).toContain(q.name);
    expect(head(page).title).toBe("Free Online PDF, Image and Developer Tools | Toolwright");
    expect(page).not.toMatch(/70\+/);
  });

  test("a guide shows its byline, true dates, FAQ and Article markup in the HTML", async ({ request }) => {
    const page = await html(request, "/guides/compress-pdf-without-uploading");
    const h = head(page);
    expect(h.h1s).toEqual(["How to compress a PDF without uploading it"]);
    expect(strip(page)).toContain("By the Toolwright team");
    const article = jsonLd(page).find((x) => x["@type"] === "Article")!;
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(article.dateModified >= article.datePublished).toBe(true);
    expect(page).toContain(`dateTime="${article.dateModified}"`);
    expect(page).toContain('href="/tools/compress-pdf"');
    expect(jsonLd(page).some((x) => x["@type"] === "FAQPage")).toBe(true);
  });

  test("guide pages make no request that leaves the site", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/guides/does-this-tool-upload-my-files");
    await page.waitForLoadState("networkidle");
    expect(tracker.external(baseURL!)).toEqual([]);
  });
});

test.describe("crawler files", () => {
  test("robots.txt names the search and answer crawlers, the training crawlers and the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const robots = await res.text();
    for (const bot of ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "PerplexityBot", "GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"]) expect(robots, bot).toContain(`User-Agent: ${bot}`);
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    // Nothing Google needs to render a page is blocked.
    expect(robots).not.toMatch(/Disallow: \/(_next|pdfjs)/);
  });

  test("llms.txt and llms-full.txt are Markdown generated from the catalogue", async ({ request }) => {
    const short = await request.get("/llms.txt");
    expect(short.status()).toBe(200);
    expect(short.headers()["content-type"]).toContain("text/plain");
    const text = await short.text();
    expect(text.startsWith("# Toolwright")).toBe(true);
    expect(text).toContain("/category/pdf");
    expect(text).toContain("/tools/compress-pdf");
    const full = await (await request.get("/llms-full.txt")).text();
    expect(full).toContain("/tools/subnet-calculator");
    expect((full.match(/^### /gm) ?? []).length).toBeGreaterThanOrEqual(110);
  });

  test("the sitemap carries real dates, not a build timestamp, and no priority or changefreq", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]!);
    expect(dates.length).toBeGreaterThan(100);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(xml).not.toMatch(/<priority>|<changefreq>/);
  });
});

test.describe("redirects and errors", () => {
  test("a trailing slash redirects permanently to the clean URL", async ({ request }) => {
    const res = await request.get("/tools/compress-pdf/", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toMatch(/\/tools\/compress-pdf$/);
  });

  test("the www host redirects permanently to the apex", async ({ request, baseURL }) => {
    const res = await request.get("/tools/merge-pdf", { maxRedirects: 0, headers: { host: "www.toolwright.com" } });
    expect(res.status(), `requested ${baseURL}`).toBe(308);
    expect(res.headers()["location"]).toBe(`${ORIGIN}/tools/merge-pdf`);
  });

  test("an unknown URL returns a real 404 that is not indexable", async ({ request }) => {
    const res = await request.get("/tools/this-tool-does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('content="noindex');
  });

  test("the API and the offline page are marked noindex", async ({ request }) => {
    expect((await request.get("/api/requests")).headers()["x-robots-tag"]).toContain("noindex");
    expect((await request.get("/offline.html")).headers()["x-robots-tag"]).toContain("noindex");
  });

  test("security headers survive: the policy still only allows the site's own origin", async ({ request }) => {
    const csp = (await request.get("/tools/compress-pdf")).headers()["content-security-policy"] ?? "";
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("wasm-unsafe-eval");
  });
});

/** Width and height from a PNG: an 8-byte signature, then the IHDR chunk with two big-endian numbers. */
function pngSize(png: Buffer) {
  const signature = png.subarray(0, 8).toString("hex");
  return { signature, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test.describe("link previews (WhatsApp, Facebook, LinkedIn, X, Telegram, Slack, Discord)", () => {
  test("every page in the sitemap has a card that resolves: a 1200x630 PNG under 300 KB", async ({ request }) => {
    test.setTimeout(240_000);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    expect(paths.length).toBeGreaterThan(100);

    const cards = new Map<string, string>();
    for (const path of paths) {
      const page = await html(request, path);
      const h = head(page);
      expect(h.ogImage, path).toMatch(/^https:\/\/toolwright\.com\/(.*\/)?opengraph-image/);
      expect(h.twitterImage, path).toBe(h.ogImage);
      expect(h.ogImageAlt.length, path).toBeGreaterThan(10);
      expect(page, path).toContain('<meta property="og:image:type" content="image/png"/>');
      expect(page, path).toContain('<meta property="og:image:width" content="1200"/>');
      expect(page, path).toContain('<meta property="og:image:height" content="630"/>');
      expect(page, path).toContain('<meta name="twitter:card" content="summary_large_image"/>');
      cards.set(new URL(h.ogImage).pathname, path);
    }

    // Pages should not all share one card: the home page, a tool, a category and a guide each have their own.
    expect(cards.size).toBeGreaterThan(100);
    for (const [cardPath, page] of cards) {
      const res = await request.get(cardPath);
      expect(res.status(), `${cardPath} (from ${page})`).toBe(200);
      expect(res.headers()["content-type"], cardPath).toBe("image/png");
      const body = await res.body();
      expect(body.length, `${cardPath} is ${Math.round(body.length / 1024)} KB`).toBeLessThan(300 * 1024);
      expect(pngSize(body), cardPath).toEqual({ signature: "89504e470d0a1a0a", width: 1200, height: 630 });
    }
  });

  test("link-preview crawlers get the tags in the head, near the top, without running any JavaScript", async ({ request }) => {
    const crawlers = ["WhatsApp/2.24.10.80 A", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "Twitterbot/1.0", "LinkedInBot/1.0", "TelegramBot (like TwitterBot)", "Slackbot-LinkExpanding 1.0", "Discordbot/2.0"];
    for (const ua of crawlers) {
      for (const path of ["/", "/tools/merge-pdf", "/guides", "/category/pdf", "/requests"]) {
        const res = await request.get(path, { headers: { "user-agent": ua } });
        expect(res.status(), `${ua} ${path}`).toBe(200);
        const page = await res.text();
        const where = page.indexOf('property="og:image"');
        expect(where, `${ua} ${path}: og:image`).toBeGreaterThan(0);
        expect(where, `${ua} ${path}: og:image must sit inside <head>`).toBeLessThan(page.indexOf("</head>"));
        expect(where, `${ua} ${path}: og:image must be near the top of the HTML`).toBeLessThan(16_000);
        for (const tag of ['property="og:title"', 'property="og:description"', 'property="og:url"', 'property="og:type"']) expect(page, `${ua} ${path}`).toContain(tag);
      }
    }
  });

  test("a guide is an article with real dates, and the other pages are websites", async ({ request }) => {
    const guide = await html(request, "/guides/compress-pdf-without-uploading");
    expect(guide).toContain('<meta property="og:type" content="article"/>');
    expect(guide).toMatch(/<meta property="article:published_time" content="\d{4}-\d{2}-\d{2}/);
    expect(guide).toMatch(/<meta property="article:modified_time" content="\d{4}-\d{2}-\d{2}/);
    expect(await html(request, "/tools/merge-pdf")).toContain('<meta property="og:type" content="website"/>');
  });

  test("the cards differ by page and say the right thing", async ({ request }) => {
    const sizes = new Set<number>();
    for (const path of ["/opengraph-image", "/tools/opengraph-image", "/guides/opengraph-image", "/category/pdf/opengraph-image", "/requests/opengraph-image", "/about/opengraph-image", "/privacy/opengraph-image", "/contribute/opengraph-image"]) {
      sizes.add((await (await request.get(path)).body()).length);
    }
    expect(sizes.size).toBe(8);
  });
});
