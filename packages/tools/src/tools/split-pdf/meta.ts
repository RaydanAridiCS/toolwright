import { Scissors } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "split-pdf",
  name: "Split PDF",
  tagline: "Split a PDF into single pages, fixed chunks or custom ranges.",
  description:
    "Break a PDF into separate files: one per page, every N pages, or custom page ranges like 1-3; 4-6. Download the pieces individually or as a ZIP. Processed locally, so nothing is uploaded.",
  category: "pdf",
  keywords: ["split pdf", "separate pdf pages", "divide pdf", "pdf splitter", "extract pages", "break up pdf"],
  icon: Scissors,
  popular: true,
  related: ["extract-pdf-pages", "merge-pdf", "delete-pdf-pages", "rotate-pdf", "compress-pdf"],
});
