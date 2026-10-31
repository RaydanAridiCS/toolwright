import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS, SEARCH_AND_ANSWER_CRAWLERS, TRAINING_CRAWLERS, allowTrainingCrawlers } from "../lib/crawler-policy";
import { absoluteUrl } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  const disallow = [...DISALLOWED_PATHS];
  // A crawler that matches a named group ignores the "*" group, so each named group repeats the disallow list.
  const named = (agents: readonly string[], allowed: boolean) => agents.map((userAgent) => (allowed ? { userAgent, allow: "/", disallow } : { userAgent, disallow: "/" }));
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...named(SEARCH_AND_ANSWER_CRAWLERS, true),
      ...named(TRAINING_CRAWLERS, allowTrainingCrawlers()),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
