import { renderOgCard } from "../../lib/og-card";
import { OG_SIZE } from "../../lib/seo";

export const alt = "Toolwright request board: suggest the next tool";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgCard({ name: "Request a tool", tagline: "Suggest the next Toolwright tool and vote on ideas. No account needed.", caption: "THE REQUEST BOARD" });
}
