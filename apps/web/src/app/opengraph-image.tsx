import { renderOgCard } from "../lib/og-card";
import { OG_SIZE } from "../lib/seo";

export const alt = "Toolwright: free, private online tools that run in your browser";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "Do the job. Keep the data.", tagline: "Free PDF, image, developer and text tools that run in your browser. Nothing is uploaded.", caption: "TOOL CATALOGUE" });
}
