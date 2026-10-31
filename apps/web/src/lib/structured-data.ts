import { CATEGORY_BY_ID, type Category, type CategoryId, type ToolMeta } from "@toolwright/tools";
import { SITE, absoluteUrl } from "./site";

/**
 * JSON-LD builders. Pure functions, so tests can parse the output and compare it with what a page shows.
 * Everything here describes visible content; there is no rating, review or user-count markup, because we have none.
 */

type Ld = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;

/** Inline, so a page that is not the home page still names its publisher; the shared @id lets crawlers join them. */
const PUBLISHER = { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE.name, url: SITE.url };

const APPLICATION_CATEGORY: Record<CategoryId, string> = {
  text: "UtilitiesApplication",
  developer: "DeveloperApplication",
  data: "DeveloperApplication",
  encoding: "DeveloperApplication",
  image: "MultimediaApplication",
  pdf: "BusinessApplication",
  design: "DesignApplication",
  generators: "UtilitiesApplication",
  calculators: "UtilitiesApplication",
};

export function organizationLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl("/icons/512"),
    description: SITE.description,
    sameAs: [SITE.repo],
  };
}

export function websiteLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE.name,
    url: absoluteUrl("/"),
    description: SITE.description,
    inLanguage: "en",
    publisher: PUBLISHER,
    // /tools?q=… filters the catalogue in the page, so the search URL is real.
    potentialAction: { "@type": "SearchAction", target: `${absoluteUrl("/tools")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

/** Sentences of a description, used as the feature list. */
function features(tool: ToolMeta): string[] {
  const sentences = (tool.seoDescription ?? tool.description)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.!?]$/, ""))
    .filter((s) => s.length > 12 && !/^free\b/i.test(s));
  return [...sentences, "Runs in your browser: nothing you add is uploaded", "No sign-up and no watermark"];
}

export function toolLd(tool: ToolMeta): Ld {
  const url = absoluteUrl(`/tools/${tool.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${url}#app`,
    name: tool.name,
    url,
    description: tool.seoDescription ?? tool.description,
    applicationCategory: APPLICATION_CATEGORY[tool.category],
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser with JavaScript enabled",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: features(tool),
    inLanguage: "en",
    license: "https://opensource.org/licenses/MIT",
    publisher: PUBLISHER,
  };
}

export function faqLd(faq: readonly { question: string; answer: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function howToLd(name: string, steps: readonly string[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    step: steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, name: text, text })),
  };
}

export function itemListLd(name: string, path: string, items: readonly { name: string; path: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: absoluteUrl(path),
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: absoluteUrl(item.path) })),
    },
  };
}

export function categoryLd(category: Category, list: readonly ToolMeta[]): Ld {
  return itemListLd(CATEGORY_BY_ID[category.id].name, `/category/${category.id}`, list.map((t) => ({ name: t.name, path: `/tools/${t.slug}` })));
}

export interface ArticleInput {
  title: string;
  description: string;
  path: string;
  published: string;
  updated: string;
}

export function articleLd({ title, description, path, published, updated }: ArticleInput): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: absoluteUrl(path),
    url: absoluteUrl(path),
    datePublished: published,
    dateModified: updated,
    inLanguage: "en",
    author: PUBLISHER,
    publisher: PUBLISHER,
    image: absoluteUrl(`${path}/opengraph-image`),
  };
}
