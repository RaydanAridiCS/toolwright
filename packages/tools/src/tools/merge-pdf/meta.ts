import { Merge } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "merge-pdf",
  name: "Merge PDF",
  tagline: "Combine several PDF files into one, in the order you choose.",
  description:
    "Merge multiple PDFs into a single document. Drag files in, reorder them, and download the combined file. Your PDFs are processed entirely in your browser: nothing is uploaded, and there are no page limits or watermarks.",
  primaryKeyword: "merge pdf",
  seoTitle: "Merge PDF Files Online Free, No Upload",
  seoDescription:
    "Combine several PDFs into one in your browser. Reorder files, no upload, no sign-up, no watermark. Your documents stay on your device.",
  answer:
    "Merge PDF combines several PDF files into one document in your browser. Add the files, put them in order and download the result. Nothing is uploaded, and there is no sign-up and no watermark.",
  category: "pdf",
  keywords: ["merge pdf", "combine pdf", "join pdf", "pdf merger", "append pdf", "free pdf merge no upload"],
  icon: Merge,
  popular: true,
  howTo: ["Add two or more PDF files.", "Use the arrows to put them in the right order.", "Click Merge and download the combined PDF."],
  faq: [
    { question: "Are my PDFs uploaded to a server?", answer: "No. Merging runs in your browser with pdf-lib. You can disconnect from the internet after the page loads and it still works." },
    { question: "Is there a size or page limit?", answer: "There is no limit imposed by Toolwright; the practical limit is your device's memory. Merging a few hundred megabytes is usually fine on a modern computer." },
  ],
  nextStep: { slug: "compress-pdf", text: "Merged file too large to email? Compress the PDF." },
  related: ["split-pdf", "extract-pdf-pages", "images-to-pdf", "rotate-pdf", "compress-pdf", "sign-pdf"],
});
