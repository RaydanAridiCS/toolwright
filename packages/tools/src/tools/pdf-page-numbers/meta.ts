import { ListOrdered } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-page-numbers",
  name: "Add Page Numbers to PDF",
  tagline: "Stamp page numbers on every page of a PDF.",
  description: "Add page numbers to a PDF in the position, format and starting number you choose (1, 1 of N, or Page 1). Runs in your browser; your document is never uploaded.",
  primaryKeyword: "add page numbers to pdf",
  seoTitle: "Add Page Numbers to PDF Online, No Upload",
  seoDescription:
    "Add page numbers to a PDF in the position, format and starting number you choose. Free, and your document is never uploaded.",
  answer:
    "Add Page Numbers to PDF stamps page numbers on every page of a PDF, in the position, format and starting number you choose, such as 1, 1 of N or Page 1. It runs in your browser, so your document is never uploaded.",
  category: "pdf",
  keywords: ["add page numbers to pdf", "number pdf pages", "pdf pagination", "page numbering", "footer page number"],
  icon: ListOrdered,
  howTo: ["Drop a PDF into the box.", "Choose the position, the format and the starting number.", "Download the numbered PDF."],
  faq: [
    { question: "How do I add page numbers to a PDF?", answer: "Drop the PDF, choose the position, format and starting number, and download the numbered file." },
    { question: "Can I start numbering from a different number?", answer: "Yes. Set the starting number you want." },
    { question: "Can I number only some pages?", answer: "The tool numbers every page. To skip pages, remove them first or split the file." },
  ],
  nextStep: { slug: "pdf-watermark", text: "Marking the document as a draft too? Add a watermark." },
  related: ["pdf-watermark", "merge-pdf", "pdf-metadata-editor"],
});
