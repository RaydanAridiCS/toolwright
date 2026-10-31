/**
 * Which crawlers may read the site. Documented in docs/seo.md.
 *
 * Search and answer crawlers fetch pages so the site can be found and cited, so they are always allowed.
 * Training crawlers collect pages to train models. Allowing them is the owner's call: it is on by default and
 * one environment variable (TOOLWRIGHT_AI_TRAINING=block, read when the site is built) turns it off.
 */

/** Crawlers that index the site or fetch a page because a person asked a question about it. Always allowed. */
export const SEARCH_AND_ANSWER_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
] as const;

/** Crawlers that collect pages to train models. Allowed unless TOOLWRIGHT_AI_TRAINING=block. */
export const TRAINING_CRAWLERS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"] as const;

export function allowTrainingCrawlers(env: Record<string, string | undefined> = process.env): boolean {
  return env.TOOLWRIGHT_AI_TRAINING?.toLowerCase() !== "block";
}

/** Paths nobody should crawl: the request-board API. */
export const DISALLOWED_PATHS = ["/api/"] as const;
