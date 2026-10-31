import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "About Toolwright: a free, open-source workshop of private tools";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "About Toolwright", tagline: "A free, open-source workshop of private online tools that run in your browser.", caption: "ABOUT" });
}
