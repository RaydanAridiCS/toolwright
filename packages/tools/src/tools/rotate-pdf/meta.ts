import { RotateCw } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "rotate-pdf",
  name: "Rotate PDF Pages",
  tagline: "Rotate all or selected PDF pages by 90°, 180° or 270°.",
  description: "Fix sideways or upside-down scans by rotating every page, or only the pages you choose. The rotation is saved in the file. Processed locally in your browser.",
  category: "pdf",
  keywords: ["rotate pdf", "rotate pdf pages", "flip pdf", "fix sideways pdf", "turn pdf"],
  icon: RotateCw,
  related: ["merge-pdf", "split-pdf", "extract-pdf-pages", "pdf-organizer"],
});
