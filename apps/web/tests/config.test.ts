// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, tools } from "@toolwright/tools";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadHeaders(env: "production" | "development") {
  vi.stubEnv("NODE_ENV", env);
  vi.resetModules();
  const config = (await import("../next.config")).default;
  const rules = await config.headers!();
  const all = rules.find((r) => r.source === "/:path*")!.headers;
  const get = (key: string) => all.find((h) => h.key === key)?.value ?? "";
  return { rules, all, get, csp: get("Content-Security-Policy") };
}

const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name);

describe("security headers", () => {
  it("production CSP only allows the site's own origin for connections, scripts, fonts and frames", async () => {
    const { csp } = await loadHeaders("production");
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "font-src")).toBe("font-src 'self' data:");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("never allows third-party hosts or eval in production", async () => {
    const { csp } = await loadHeaders("production");
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\bws:|wss:/);
  });

  it("only relaxes the policy for local development (eval + websocket for hot reload)", async () => {
    const { csp } = await loadHeaders("development");
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("sets the other protective headers", async () => {
    const { get } = await loadHeaders("production");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("X-Frame-Options")).toBe("DENY");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) expect(get("Permissions-Policy")).toContain(`${feature}=()`);
  });

  it("always revalidates the service worker", async () => {
    const { rules } = await loadHeaders("production");
    const sw = rules.find((r) => r.source === "/sw.js");
    expect(sw?.headers).toEqual(expect.arrayContaining([{ key: "Cache-Control", value: "no-cache" }]));
  });

  it("does not advertise the framework", async () => {
    vi.resetModules();
    const config = (await import("../next.config")).default;
    expect(config.poweredByHeader).toBe(false);
  });
});

describe("SEO files", () => {
  it("sitemap lists every tool, category and key page exactly once", async () => {
    const sitemap = (await import("../src/app/sitemap")).default();
    const urls = sitemap.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const t of tools) expect(urls).toContain(`https://toolwright.com/tools/${t.slug}`);
    for (const c of CATEGORIES) expect(urls).toContain(`https://toolwright.com/category/${c.id}`);
    for (const p of ["/", "/tools", "/requests", "/privacy", "/about", "/contribute"]) expect(urls).toContain(p === "/" ? "https://toolwright.com/" : `https://toolwright.com${p}`);
    // priority and changefreq are ignored by search engines, so they are left out; lastmod is a real date.
    expect(sitemap.some((s) => s.priority !== undefined || s.changeFrequency !== undefined)).toBe(false);
    for (const s of sitemap.filter((x) => !x.url.endsWith("/requests"))) expect(String(s.lastModified), s.url).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("robots allows crawling but hides the API and points at the sitemap", async () => {
    const robots = (await import("../src/app/robots")).default();
    expect(robots.sitemap).toBe("https://toolwright.com/sitemap.xml");
    const rule = Array.isArray(robots.rules) ? robots.rules[0]! : robots.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toContain("/api/");
  });

  it("web manifest is installable", async () => {
    const manifest = (await import("../src/app/manifest")).default();
    expect(manifest).toMatchObject({ short_name: "Toolwright", display: "standalone", start_url: "/", scope: "/" });
    const sizes = manifest.icons!.map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons!.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("site helpers build absolute URLs", async () => {
    const { absoluteUrl, SITE } = await import("../src/lib/site");
    expect(absoluteUrl("/tools")).toBe("https://toolwright.com/tools");
    expect(absoluteUrl("tools")).toBe("https://toolwright.com/tools");
    expect(SITE.url.endsWith("/")).toBe(false);
  });
});

describe("brand", () => {
  it("never uses orange in the design tokens", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const hexes = [...css.matchAll(/--[a-z-0-9]+:\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => m[1]!);
    expect(hexes.length).toBeGreaterThan(20);
    for (const hex of hexes) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) continue;
      let h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      h = (h * 60 + 360) % 360;
      const saturation = (max - min) / max;
      const orange = h >= 15 && h <= 45 && saturation > 0.5 && max > 150;
      // Status tokens may be yellow (warning), but nothing in the palette is a saturated orange.
      expect(orange, `${hex} (hue ${Math.round(h)}°) looks orange`).toBe(false);
    }
  });
});
