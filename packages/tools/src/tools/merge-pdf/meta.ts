import { Merge } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "merge-pdf",
  name: "Merge PDF",
  tagline: "Combine several PDF files into one, in the order you choose.",
  description:
    "Merge multiple PDFs into a single document. Drag files in, reorder them, and download the combined file. Your PDFs are processed entirely in your browser: nothing is uploaded, and there are no page limits or watermarks.",
  category: "pdf",
  keywords: ["merge pdf", "combine pdf", "join pdf", "pdf merger", "append pdf", "free pdf merge no upload"],
  icon: Merge,
  popular: true,
  howTo: ["Add two or more PDF files.", "Use the arrows to put them in the right order.", "Click Merge and download the combined PDF."],
  faq: [
    { question: "Are my PDFs uploaded to a server?", answer: "No. Merging runs in your browser with pdf-lib. You can disconnect from the internet after the page loads and it still works." },
    { question: "Is there a size or page limit?", answer: "There is no limit imposed by Toolwright; the practical limit is your device's memory. Merging a few hundred megabytes is usually fine on a modern computer." },
  ],
  related: ["split-pdf", "extract-pdf-pages", "images-to-pdf", "rotate-pdf", "compress-pdf"],
});
