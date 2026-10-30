import { FileText } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-to-text",
  name: "PDF to Text",
  tagline: "Copy the text out of a PDF, page by page, without uploading it.",
  description:
    "Read the text from a PDF and copy it or save it as a .txt file. Lines, paragraphs and split words are put back together, and pages can be marked. The PDF is read in your browser and never leaves your device. Scanned pages have no text to read.",
  category: "pdf",
  keywords: ["pdf to text", "extract text from pdf", "copy text from pdf", "pdf to txt", "pdf text extractor", "read pdf text", "convert pdf to text"],
  icon: FileText,
  howTo: [
    "Drop a PDF into the box. It stays on your device.",
    "Choose whether to mark the pages and join words split at a line end.",
    "Copy the text or download it as a .txt file.",
  ],
  faq: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. The text is read by PDF.js in your browser, from this site's own files. Nothing is sent anywhere.",
    },
    {
      question: "Why is the text empty for my PDF?",
      answer: "The PDF is probably a scan or a set of pictures. It looks like text but contains only images, so there is nothing to copy. Reading text from pictures needs OCR, which this tool does not do. The page tells you when this is the case.",
    },
    {
      question: "Why are the columns or tables jumbled?",
      answer: "A PDF does not store sentences, only small pieces of text placed on the page. The tool rebuilds lines from their positions, which works for ordinary documents. Multi-column layouts and tables can come out in an order you did not expect, because the PDF stores them in that order.",
    },
    {
      question: "What does joining split words do?",
      answer: "When a line ends with a hyphen after a lowercase letter and the next line starts in lowercase, the two halves are joined into one word. Hyphens before a capital letter or a number are kept. Turn it off if you want the text exactly as laid out.",
    },
    {
      question: "Does it keep bold, headings or images?",
      answer: "No. You get plain text only. For pictures of the pages use PDF to Images.",
    },
    {
      question: "Can it open a password-protected PDF?",
      answer: "No. Remove the password first, then drop the file here.",
    },
  ],
  related: ["pdf-to-images", "compress-pdf", "word-counter", "readability-score", "extract-pdf-pages", "html-to-markdown"],
});
