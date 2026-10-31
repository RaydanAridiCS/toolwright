import { GUIDES, getGuide } from "../../../content/guides";
import { renderOgCard, shortLine } from "../../../lib/og-card";
import { OG_SIZE } from "../../../lib/seo";

export const alt = "Toolwright guide";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  return renderOgCard({ name: guide?.h1 ?? "Toolwright guide", tagline: shortLine(guide?.seoDescription ?? "Plain answers, linked to tools that work on your device."), caption: "GUIDE" });
}
