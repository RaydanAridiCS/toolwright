import { tools } from "@toolwright/tools";
import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "Toolwright: the full catalogue of free browser tools";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: `${tools.length} free browser tools`, tagline: "PDF, image, developer, text and calculator tools. Nothing is uploaded.", caption: "THE CATALOGUE" });
}
