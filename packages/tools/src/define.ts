import type { LucideIcon } from "lucide-react";

export type CategoryId = "text" | "developer" | "data" | "encoding" | "image" | "pdf" | "design" | "generators" | "calculators";

export interface ToolFaq {
  question: string;
  answer: string;
}

/**
 * Everything the site needs to know about a tool without loading its UI.
 * Lives in `tools/<slug>/meta.ts`; the matching UI is the default export of `tools/<slug>/Tool.tsx`.
 */
export interface ToolMeta {
  /** URL segment and folder name. Lowercase letters, digits and hyphens. */
  slug: string;
  /** Short display name, e.g. "JSON Formatter". */
  name: string;
  /** One line shown on cards and in search results. */
  tagline: string;
  /** 1–3 sentences for the page header and meta description. Mention what runs locally. */
  description: string;
  category: CategoryId;
  /** Search terms and SEO keywords, including common synonyms. */
  keywords: string[];
  icon: LucideIcon;
  /** Optional numbered "How to use" steps. */
  howTo?: string[];
  faq?: ToolFaq[];
  /** Slugs of related tools. */
  related?: string[];
  /** Highlight on the home page. */
  popular?: boolean;
  /** The one search query this page is meant to own, lower case ("compress pdf"). Unique across tools. */
  primaryKeyword?: string;
  /** Search-result title WITHOUT the brand (the page adds " | Toolwright"). 25-47 characters, contains `primaryKeyword`. */
  seoTitle?: string;
  /** Meta description, 110-160 characters: a clear benefit, the privacy angle, no stuffing. Unique across tools. */
  seoDescription?: string;
  /** Answer-first summary shown under the H1, 80-320 characters, written so it can be quoted on its own. Contains `primaryKeyword`. */
  answer?: string;
  /** Optional "what to do next" link on the tool page; `text` is the descriptive anchor sentence. */
  nextStep?: { slug: string; text: string };
}

export function defineTool<T extends ToolMeta>(meta: T): T {
  return meta;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
