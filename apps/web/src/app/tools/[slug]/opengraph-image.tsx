import { CATEGORY_BY_ID, getTool, tools } from "@toolwright/tools";
import { renderOgCard } from "../../../lib/og-card";
import { OG_SIZE } from "../../../lib/seo";

export const alt = "Toolwright tool";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  const index = tool ? String(tools.findIndex((t) => t.slug === tool.slug) + 1).padStart(3, "0") : "";
  return renderOgCard({
    name: tool?.name ?? "Toolwright",
    tagline: tool?.tagline ?? "Do the job. Keep the data.",
    caption: tool ? `TOOL ${index} · ${CATEGORY_BY_ID[tool.category].name.toUpperCase()}` : "TOOL CATALOGUE",
  });
}
