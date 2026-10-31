import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "How Toolwright keeps your files private";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "How privacy works", tagline: "Exactly what runs on your device, what is stored, and how you can check it yourself.", caption: "PRIVACY" });
}
