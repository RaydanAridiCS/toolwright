import { CATEGORY_BY_ID, CATEGORIES } from "./categories";
import type { CategoryId, ToolMeta } from "./define";
import { tools } from "./registry.generated";

export { CATEGORIES, CATEGORY_BY_ID, isCategoryId, type Category } from "./categories";
export { defineTool, SLUG_PATTERN, type CategoryId, type ToolFaq, type ToolMeta } from "./define";
export { tools };

const bySlug = new Map(tools.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolMeta | undefined {
  return bySlug.get(slug);
}

export function toolsByCategory(category: CategoryId): ToolMeta[] {
  return tools.filter((t) => t.category === category).sort((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)) || a.name.localeCompare(b.name));
}

/** Hand-picked order for the home page and search suggestions: the tools people reach for most. */
export const FEATURED_SLUGS = [
  "merge-pdf",
  "compress-pdf",
  "image-compressor",
  "json-formatter",
  "qr-code-generator",
  "password-generator",
  "text-diff",
  "unit-converter",
  "jwt-decoder",
  "image-converter",
  "word-counter",
  "hash-generator",
  "timestamp-converter",
] as const;

/** Featured tools first (in the order above), then any other popular tools alphabetically. */
export function popularTools(limit = 12): ToolMeta[] {
  const featured = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter((t): t is ToolMeta => Boolean(t));
  const rest = tools.filter((t) => t.popular && !featured.includes(t));
  return [...featured, ...rest].slice(0, limit);
}

/** Related tools: explicit `related` slugs first, then others from the same category. */
export function relatedTools(slug: string, limit = 4): ToolMeta[] {
  const tool = bySlug.get(slug);
  if (!tool) return [];
  const explicit = (tool.related ?? []).map((s) => bySlug.get(s)).filter((t): t is ToolMeta => Boolean(t) && t?.slug !== slug);
  const sameCategory = tools.filter((t) => t.category === tool.category && t.slug !== slug && !explicit.includes(t));
  return [...explicit, ...sameCategory].slice(0, limit);
}

export interface SearchHit {
  tool: ToolMeta;
  score: number;
}

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Ranked search over name, keywords, tagline and description. Every word in the query must match
 * somewhere; name and keyword matches score higher than description matches.
 */
export function searchTools(query: string, limit = 20): SearchHit[] {
  const words = normalize(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const tool of tools) {
    const name = normalize(tool.name);
    const slug = tool.slug;
    const keywords = tool.keywords.map(normalize);
    const tagline = normalize(tool.tagline);
    const description = normalize(tool.description);
    const category = normalize(CATEGORY_BY_ID[tool.category].name);
    let total = 0;
    let matchedAll = true;
    for (const word of words) {
      let best = 0;
      if (name.startsWith(word) || name.split(/[^a-z0-9]+/).some((w) => w.startsWith(word))) best = Math.max(best, name.startsWith(word) ? 100 : 80);
      else if (name.includes(word)) best = Math.max(best, 60);
      if (slug.includes(word)) best = Math.max(best, 55);
      if (keywords.some((k) => k === word || k.split(" ").includes(word))) best = Math.max(best, 50);
      else if (keywords.some((k) => k.includes(word))) best = Math.max(best, 35);
      if (tagline.includes(word)) best = Math.max(best, 15);
      if (category.includes(word)) best = Math.max(best, 10);
      if (description.includes(word)) best = Math.max(best, 5);
      if (best === 0) {
        matchedAll = false;
        break;
      }
      total += best;
    }
    if (matchedAll) hits.push({ tool, score: total + (tool.popular ? 2 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name)).slice(0, limit);
}

export function categoriesWithCounts() {
  return CATEGORIES.map((category) => ({ ...category, count: tools.filter((t) => t.category === category.id).length })).filter((c) => c.count > 0);
}

export { CATEGORY_CONTENT, type CategoryContent } from "./seo/category-content";
