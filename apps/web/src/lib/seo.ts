import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

export const OG_SIZE = { width: 1200, height: 630 } as const;

interface PageMeta {
  /** Title without the brand; the layout's title template adds " | Toolwright". */
  title: string;
  description: string;
  /** Path of the page, starting with a slash. The canonical URL is built from it. */
  path: string;
  /**
   * Social image path and its alt text. Every page has its own card at `<path>/opengraph-image`
   * (a route next to the page), so that is the default; pass this only to point somewhere else.
   */
  image?: { path: string; alt: string };
  /** Page title for social cards when it should differ from `title`. */
  ogTitle?: string;
  /** Guides are articles: link previews and feeds then know when they were published and last changed. */
  article?: { published: string; updated: string };
  noindex?: boolean;
}

/** The card route for a page: `/` is `/opengraph-image`, `/guides` is `/guides/opengraph-image`. */
export function cardPath(path: string): string {
  return `${path === "/" ? "" : path}/opengraph-image`;
}

/**
 * One place that builds a page's metadata, so every page has its own title, description, canonical URL
 * and social card instead of inheriting the home page's.
 *
 * The image entry carries everything link-preview crawlers (WhatsApp, Facebook, LinkedIn, X, Telegram, Slack,
 * Discord) look for: an absolute https URL, its type, its size and an alt text. Cards are PNG and well under
 * the ~300 KB WhatsApp likes; an e2e test checks that for every page in the sitemap.
 */
export function pageMetadata({ title, description, path, image, ogTitle, article, noindex }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const social = ogTitle ?? `${title} | ${SITE.name}`;
  const card = image ?? { path: cardPath(path), alt: `${SITE.name}: ${title}` };
  const cardUrl = absoluteUrl(card.path);
  const images = [{ url: cardUrl, ...(cardUrl.startsWith("https://") ? { secureUrl: cardUrl } : {}), type: "image/png", ...OG_SIZE, alt: card.alt }];
  const common = { title: social, description, url, siteName: SITE.name, locale: "en_US", images };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: article ? { ...common, type: "article", publishedTime: article.published, modifiedTime: article.updated } : { ...common, type: "website" },
    twitter: { card: "summary_large_image", title: social, description, images: [{ url: cardUrl, alt: card.alt }] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
