import { Shrink } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "compress-pdf",
  name: "Compress PDF",
  tagline: "Make a PDF smaller by recompressing its images. Nothing is uploaded.",
  description:
    "Shrink a PDF in your browser. Keep text recompresses the photos inside and leaves text, links and forms alone. Smallest file turns each page into a picture for the biggest saving. Your file never leaves your device, and you are never handed a file larger than the original.",
  category: "pdf",
  keywords: ["compress pdf", "reduce pdf size", "shrink pdf", "pdf compressor", "make pdf smaller", "compress pdf no upload", "pdf too large"],
  icon: Shrink,
  popular: true,
  howTo: [
    "Drop a PDF. The tool lists how much of it is images.",
    "Choose Keep text (recompress photos only) or Smallest file (every page becomes a picture, so text can no longer be selected).",
    "Pick Light, Balanced or Strong, then compress and download. If the result would not be smaller, you get your original back.",
  ],
  faq: [
    {
      question: "Is my PDF uploaded to a server?",
      answer: "No. The work happens in a background thread of this tab. Check the Network tab of your browser's developer tools: no request carries your file. Disconnect from the internet after the page loads and it still works.",
    },
    {
      question: "What is the difference between Keep text and Smallest file?",
      answer:
        "Keep text only recompresses the JPEG photos inside the PDF. Text stays selectable and searchable, and links, forms and bookmarks keep working. Smallest file draws every page and saves it as a picture. That usually saves the most, but you lose selectable text, copy and paste, links, fillable fields, bookmarks and screen-reader structure.",
    },
    {
      question: "Why did Keep text save nothing?",
      answer:
        "It can only recompress JPEG images. A PDF with no images, or with images stored without loss (common for screenshots and exports from office software), black-and-white scans, JPEG 2000 or CMYK photos has nothing it can shrink. The tool lists what it skipped. Smallest file can still shrink those, at the cost of the text.",
    },
    {
      question: "Can it make my file bigger?",
      answer: "No. If the result is not smaller than your original (or, for Smallest file, at least 10% smaller), the tool says so and offers your original instead.",
    },
    {
      question: "What about password-protected and signed PDFs?",
      answer: "Password-protected files are refused: remove the password first. A digitally signed PDF can be compressed, but any change makes the signature invalid, and the tool warns you before you start.",
    },
    {
      question: "Will the colors change?",
      answer: "Photos are recompressed as ordinary RGB or gray JPEGs, so colors can shift slightly for images that used a wide-gamut color profile. Smallest file also falls back to simpler color handling for those profiles.",
    },
    {
      question: "Is there a size limit?",
      answer: "Files up to 200 MB, and up to 1,000 pages for Smallest file. Bigger files can exhaust a browser tab's memory, so the tool refuses them and suggests splitting the file first. Large files can take a minute or more; you can cancel at any time.",
    },
  ],
  related: ["merge-pdf", "split-pdf", "images-to-pdf", "image-compressor", "pdf-to-images", "pdf-to-text"],
});
