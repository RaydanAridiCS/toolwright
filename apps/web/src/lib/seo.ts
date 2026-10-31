import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

export const OG_SIZE = { width: 1200, height: 630 } as const;

interface PageMeta {
  /** Title without the brand; the layout's title template adds " | Toolwright". */
  title: string;
  description: string;
  /** Path of the page, starting with a slash. The canonical URL is built from it. */
  path: string;
  /** Social image path and its alt text. Defaults to the site-wide card. */
  image?: { path: string; alt: string };
  /** Page title for social cards when it should differ from `title`. */
  ogTitle?: string;
  noindex?: boolean;
}

const DEFAULT_IMAGE = { path: "/opengraph-image", alt: "Toolwright: free, private online tools that run in your browser" };

/**
 * One place that builds a page's metadata, so every page has its own title, description, canonical URL
 * and social card instead of inheriting the home page's.
 */
export function pageMetadata({ title, description, path, image = DEFAULT_IMAGE, ogTitle, noindex }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const social = ogTitle ?? `${title} | ${SITE.name}`;
  const images = [{ url: absoluteUrl(image.path), ...OG_SIZE, alt: image.alt }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title: social, description, url, siteName: SITE.name, locale: "en_US", images },
    twitter: { card: "summary_large_image", title: social, description, images: [{ url: absoluteUrl(image.path), alt: image.alt }] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
