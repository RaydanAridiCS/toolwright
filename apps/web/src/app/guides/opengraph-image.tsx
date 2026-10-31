import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "Toolwright guides: plain answers on PDFs, images and privacy";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "Guides", tagline: "Plain answers on PDFs, images, privacy and networking, each linked to a tool that works on your device.", caption: "THE READING SHELF" });
}
