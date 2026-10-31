import type { MetadataRoute } from "next";
import { CATEGORIES, tools, toolsByCategory } from "@toolwright/tools";
import { GUIDES } from "../content/guides";
import lastmod from "../lib/lastmod.generated.json";
import { absoluteUrl } from "../lib/site";

const toolDates = lastmod.tools as Record<string, string>;
const pageDates = lastmod.pages as Record<string, string>;
const latest = (dates: (string | undefined)[]) => dates.filter((d): d is string => Boolean(d)).sort().at(-1);

/**
 * Every indexable URL, with the date its source last changed (see scripts/gen-lastmod.mjs).
 * priority and changefreq are left out: search engines ignore them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const allToolDates = tools.map((t) => toolDates[t.slug]);
  const entry = (path: string, date?: string) => ({ url: absoluteUrl(path), ...(date ? { lastModified: date } : {}) });
  return [
    entry("/", latest([pageDates["/"], ...allToolDates])),
    entry("/tools", latest([pageDates["/tools"], ...allToolDates])),
    ...CATEGORIES.map((c) => entry(`/category/${c.id}`, latest(toolsByCategory(c.id).map((t) => toolDates[t.slug])))),
    ...tools.map((t) => entry(`/tools/${t.slug}`, toolDates[t.slug])),
    entry("/guides", latest(GUIDES.map((g) => g.updated))),
    ...GUIDES.map((g) => entry(`/guides/${g.slug}`, g.updated)),
    entry("/privacy", pageDates["/privacy"]),
    entry("/about", pageDates["/about"]),
    entry("/contribute", pageDates["/contribute"]),
    entry("/requests"),
  ];
}
