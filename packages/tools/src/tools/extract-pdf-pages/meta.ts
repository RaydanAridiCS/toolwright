import { FileOutput } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "extract-pdf-pages",
  name: "Extract PDF Pages",
  tagline: "Pull selected pages out of a PDF into a new file, in any order.",
  description:
    "Create a new PDF from specific pages of an existing one. Enter ranges like 1-3, 7, 10- to keep only what you need. You can also reorder pages by listing them in the order you want. Runs in your browser.",
  category: "pdf",
  keywords: ["extract pdf pages", "select pages from pdf", "pdf page extractor", "reorder pdf pages", "keep pages"],
  icon: FileOutput,
  related: ["delete-pdf-pages", "split-pdf", "merge-pdf", "pdf-organizer"],
});
