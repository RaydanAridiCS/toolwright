import { FileX } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "delete-pdf-pages",
  name: "Delete PDF Pages",
  tagline: "Remove unwanted pages from a PDF.",
  description: "Delete blank, duplicate or sensitive pages from a PDF by entering the page numbers or ranges to remove. The rest of the document is untouched. Done locally in your browser.",
  primaryKeyword: "delete pdf pages",
  seoTitle: "Delete PDF Pages Online Free, No Upload",
  seoDescription:
    "Remove blank, duplicate or private pages from a PDF by page number. Free, no sign-up, and your file never leaves your device.",
  answer:
    "Delete PDF Pages removes the pages you list, such as 2, 5-7 or 12-, from a PDF and saves the rest as a new file. It runs in your browser, so the PDF is never uploaded.",
  category: "pdf",
  keywords: ["delete pdf pages", "remove pages from pdf", "remove blank pages pdf", "cut pages pdf", "pdf page remover"],
  icon: FileX,
  howTo: ["Drop a PDF into the box.", "Type the pages to delete, for example 2, 5-7.", "Download the new PDF."],
  faq: [
    { question: "How do I remove pages from a PDF?", answer: "Drop the PDF, type the page numbers or ranges to delete, such as 2, 5-7, and download the new file." },
    { question: "Is the original file changed?", answer: "No. You get a new PDF and your original stays as it was." },
    { question: "Does it work on password-protected PDFs?", answer: "No. Encrypted files are refused. Remove the password first, then try again." },
  ],
  nextStep: { slug: "pdf-organizer", text: "Want to see the pages while you decide? Use the PDF Page Organizer." },
  related: ["extract-pdf-pages", "split-pdf", "merge-pdf"],
});
