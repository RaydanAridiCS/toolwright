import { FileText } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-metadata-editor",
  name: "PDF Metadata Viewer & Editor",
  tagline: "See, edit or strip a PDF's title, author, dates and producer.",
  description:
    "Inspect the hidden metadata inside a PDF (title, author, subject, keywords, creator, producer and dates), edit it, or remove all of it before sharing. Processed in your browser; the file is never uploaded.",
  primaryKeyword: "pdf metadata",
  seoTitle: "PDF Metadata Viewer and Editor: Remove Author",
  seoDescription:
    "See, edit or remove a PDF's title, author, dates and producer before you share it. Free, and the file never leaves your browser.",
  answer:
    "PDF Metadata Viewer & Editor shows the hidden properties of a PDF, such as title, author, subject, keywords, creator, producer and dates, lets you edit them and can remove all of them before you share the file. It runs in your browser.",
  category: "pdf",
  keywords: ["pdf metadata", "edit pdf properties", "remove pdf metadata", "pdf author", "pdf info", "strip pdf metadata"],
  icon: FileText,
  howTo: ["Drop a PDF into the box.", "Edit the fields, or choose to remove all metadata.", "Download the new PDF."],
  faq: [
    { question: "How do I remove the author from a PDF?", answer: "Open the PDF here, clear the author field or remove all metadata, and download the new file." },
    { question: "What metadata does a PDF contain?", answer: "Typically a title, author, subject, keywords, the program that created it and creation and modification dates." },
    { question: "Is my PDF uploaded?", answer: "No. The file is read and rewritten in your browser." },
  ],
  nextStep: { slug: "compress-pdf", text: "Sharing the file? Compress it before you send it." },
  related: ["exif-remover", "merge-pdf", "pdf-watermark"],
});
