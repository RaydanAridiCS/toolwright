import { CATEGORIES, CATEGORY_CONTENT, isCategoryId, toolsByCategory } from "@toolwright/tools";
import { renderOgCard, shortLine } from "../../../lib/og-card";
import { OG_SIZE } from "../../../lib/seo";

export const alt = "Toolwright tool category";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategoryId(category)) return renderOgCard({ name: "Toolwright", tagline: "Do the job. Keep the data.", caption: "TOOL CATALOGUE" });
  const content = CATEGORY_CONTENT[category];
  const drawer = String(CATEGORIES.findIndex((c) => c.id === category) + 1).padStart(2, "0");
  return renderOgCard({ name: content.h1, tagline: shortLine(content.seoDescription), caption: `DRAWER ${drawer} · ${toolsByCategory(category).length} TOOLS` });
}
