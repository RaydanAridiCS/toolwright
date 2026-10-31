import { CATEGORIES, popularTools, toolsByCategory, tools, type ToolMeta } from "@toolwright/tools";
import { GUIDES } from "../content/guides";
import { SITE, absoluteUrl } from "./site";

/**
 * /llms.txt and /llms-full.txt: plain Markdown for language models and answer engines, generated from the same
 * registry as the pages, so they cannot drift. llms.txt is the short index; llms-full.txt has every tool's answer,
 * steps and FAQ.
 */

const link = (name: string, path: string, note?: string) => `- [${name}](${absoluteUrl(path)})${note ? `: ${note}` : ""}`;

const ABOUT = [
  `Toolwright (${SITE.url}) is a free, open-source collection of ${tools.length} online tools for PDFs, images, developers and text.`,
  "Every tool runs in the visitor's browser: files and text are processed on their device and are never uploaded.",
  "There are no accounts, no sign-up, no watermarks and no analytics or third-party scripts.",
  "Source code (MIT license): " + SITE.repo,
];

export function buildLlmsTxt(): string {
  const lines = [`# ${SITE.name}`, "", `> ${SITE.description}`, "", ...ABOUT.map((l) => `- ${l}`), ""];

  lines.push("## Categories", "");
  for (const c of CATEGORIES) lines.push(link(c.name, `/category/${c.id}`, `${c.description} (${toolsByCategory(c.id).length} tools)`));

  lines.push("", "## Popular tools", "");
  for (const t of popularTools(14)) lines.push(link(t.name, `/tools/${t.slug}`, t.tagline));

  lines.push("", "## Guides", "");
  for (const g of GUIDES) lines.push(link(g.h1, `/guides/${g.slug}`));

  lines.push("", "## More", "");
  lines.push(link("All tools", "/tools"), link("How privacy works", "/privacy", "how the no-upload promise is enforced and how to check it yourself"));
  lines.push(link("Every tool with its steps and FAQ, as one file", "/llms-full.txt"), link("Sitemap", "/sitemap.xml"), "");
  return lines.join("\n");
}

function toolSection(t: ToolMeta): string[] {
  const lines = [`### ${t.name}`, "", `URL: ${absoluteUrl(`/tools/${t.slug}`)}`, "", t.answer ?? t.description, ""];
  if (t.howTo?.length) lines.push("How to use it:", "", ...t.howTo.map((s, i) => `${i + 1}. ${s}`), "");
  if (t.faq?.length) for (const f of t.faq) lines.push(`Q: ${f.question}`, `A: ${f.answer}`, "");
  return lines;
}

export function buildLlmsFullTxt(): string {
  const lines = [`# ${SITE.name}: full catalogue`, "", `> ${SITE.description}`, "", ...ABOUT.map((l) => `- ${l}`), ""];
  for (const c of CATEGORIES) {
    lines.push(`## ${c.name}`, "", c.description, "");
    for (const t of toolsByCategory(c.id)) lines.push(...toolSection(t));
  }
  lines.push("## Guides", "");
  for (const g of GUIDES) lines.push(`### ${g.h1}`, "", `URL: ${absoluteUrl(`/guides/${g.slug}`)}`, "", g.answer, "");
  return lines.join("\n");
}
