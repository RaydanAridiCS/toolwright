import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "Build a tool for Toolwright";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "Build a tool", tagline: "Every Toolwright tool is a single folder. Add one, fix a bug or improve the docs.", caption: "CONTRIBUTE" });
}
