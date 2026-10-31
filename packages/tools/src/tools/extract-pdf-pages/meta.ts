import { FileOutput } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "extract-pdf-pages",
  name: "Extract PDF Pages",
  tagline: "Pull selected pages out of a PDF into a new file, in any order.",
  description:
    "Create a new PDF from specific pages of an existing one. Enter ranges like 1-3, 7, 10- to keep only what you need. You can also reorder pages by listing them in the order you want. Runs in your browser.",
  primaryKeyword: "extract pages from pdf",
  seoTitle: "Extract Pages from PDF Online, No Upload",
  seoDescription:
    "Pull selected pages out of a PDF into a new file, in the order you list them. Free, no sign-up, and your PDF stays in your browser.",
  answer:
    "Extract PDF Pages creates a new PDF from the pages you pick, using ranges such as 1-3, 7, 10-. List pages in a different order to reorder them. It runs in your browser, so the file is never uploaded.",
  category: "pdf",
  keywords: ["extract pdf pages", "select pages from pdf", "pdf page extractor", "reorder pdf pages", "keep pages"],
  icon: FileOutput,
  howTo: ["Drop a PDF into the box.", "Type the pages to keep, for example 1-3, 7, 10-.", "Download the new PDF."],
  faq: [
    { question: "How do I extract pages from a PDF?", answer: "Drop the PDF, type the pages you want, such as 1-3, 7, and download the new file." },
    { question: "Can I put the pages in a different order?", answer: "Yes. Pages come out in the order you list them, so 5, 1, 3 gives a file that starts with page 5." },
    { question: "What is the difference between Extract and Split?", answer: "Extract makes one new PDF from the pages you pick. Split cuts a PDF into several files." },
  ],
  nextStep: { slug: "split-pdf", text: "Need several files instead of one? Split the PDF into parts." },
  related: ["delete-pdf-pages", "split-pdf", "merge-pdf", "pdf-organizer", "pdf-to-images", "pdf-to-text"],
});
