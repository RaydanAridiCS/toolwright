import { RotateCw } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "rotate-pdf",
  name: "Rotate PDF Pages",
  tagline: "Rotate all or selected PDF pages by 90°, 180° or 270°.",
  description: "Fix sideways or upside-down scans by rotating every page, or only the pages you choose. The rotation is saved in the file. Processed locally in your browser.",
  primaryKeyword: "rotate pdf",
  seoTitle: "Rotate PDF Pages Online Free, No Upload",
  seoDescription:
    "Fix sideways or upside-down pages by rotating a whole PDF or only the pages you pick, by 90, 180 or 270 degrees. Nothing is uploaded.",
  answer:
    "Rotate PDF Pages turns every page, or only the pages you choose, by 90, 180 or 270 degrees and saves the rotation in the file. It runs in your browser, so the PDF is never uploaded.",
  category: "pdf",
  keywords: ["rotate pdf", "rotate pdf pages", "flip pdf", "fix sideways pdf", "turn pdf"],
  icon: RotateCw,
  howTo: ["Drop a PDF into the box.", "Choose the angle, and all pages or selected pages.", "Download the rotated PDF."],
  faq: [
    { question: "How do I rotate a PDF?", answer: "Drop the PDF, pick the angle and whether to turn all pages or selected ones, and download the new file." },
    { question: "Can I rotate just one page?", answer: "Yes. Choose selected pages and type the page numbers." },
    { question: "Is the rotation permanent?", answer: "Yes. The rotation is saved in the new PDF, so it opens that way in any viewer." },
  ],
  nextStep: { slug: "pdf-organizer", text: "Need to reorder or delete pages as well? Use the PDF Page Organizer." },
  related: ["merge-pdf", "split-pdf", "extract-pdf-pages", "pdf-organizer"],
});
