import { Scissors } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "split-pdf",
  name: "Split PDF",
  tagline: "Split a PDF into single pages, fixed chunks or custom ranges.",
  description:
    "Break a PDF into separate files: one per page, every N pages, or custom page ranges like 1-3; 4-6. Download the pieces individually or as a ZIP. Processed locally, so nothing is uploaded.",
  primaryKeyword: "split pdf",
  seoTitle: "Split PDF Online Free, No Upload",
  seoDescription:
    "Split a PDF into single pages, fixed chunks or custom ranges. Download the parts one by one or as a ZIP. Free, and nothing is uploaded.",
  answer:
    "Split PDF breaks a PDF into separate files: one per page, every N pages or custom page ranges such as 1-3; 4-6. Download the pieces one by one or as a ZIP. It runs in your browser, so nothing is uploaded.",
  category: "pdf",
  keywords: ["split pdf", "separate pdf pages", "divide pdf", "pdf splitter", "extract pages", "break up pdf"],
  icon: Scissors,
  popular: true,
  howTo: ["Drop a PDF into the box.", "Choose every page, every N pages or custom ranges.", "Download the files, or the whole set as a ZIP."],
  faq: [
    { question: "How do I split a PDF into separate pages?", answer: "Drop the PDF, choose every page and download the files, or the whole set as a ZIP." },
    { question: "How do I split a PDF by page ranges?", answer: "Choose ranges and separate the files with semicolons, for example 1-3; 4; 5-10." },
    { question: "Is my PDF uploaded?", answer: "No. The PDF is split in your browser." },
  ],
  nextStep: { slug: "merge-pdf", text: "Need to put pieces back together? Merge the PDFs." },
  related: ["extract-pdf-pages", "merge-pdf", "delete-pdf-pages", "rotate-pdf", "compress-pdf"],
});
