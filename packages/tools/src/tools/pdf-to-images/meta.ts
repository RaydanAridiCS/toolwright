import { Images } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-to-images",
  name: "PDF to Images",
  tagline: "Turn PDF pages into PNG, JPG or WebP pictures, as a ZIP or one by one.",
  description:
    "Save every page of a PDF, or just the pages you choose, as PNG, JPG or WebP pictures at 72 to 300 DPI. Download them one at a time or all together in a ZIP. The PDF is drawn in your browser and never leaves your device.",
  category: "pdf",
  keywords: ["pdf to jpg", "pdf to png", "pdf to image", "pdf to images", "convert pdf to picture", "pdf page to image", "save pdf as image", "pdf to webp", "export pdf pages"],
  icon: Images,
  howTo: [
    "Drop a PDF into the box. It stays on your device.",
    "Choose the pages, the resolution and the picture format.",
    "Select Make pictures, then download single pages or the whole ZIP.",
  ],
  faq: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. Your browser draws each page itself, using PDF.js that is served from this site. Nothing is sent anywhere, and the pictures are made in memory on your device.",
    },
    {
      question: "Which resolution should I choose?",
      answer: "72 to 96 DPI matches a screen and gives small files. 150 DPI is a good all-round choice for sharing. 300 DPI is for printing. Very large pages are drawn a little smaller than asked so the browser does not run out of memory, and the page says when that happened.",
    },
    {
      question: "PNG, JPG or WebP?",
      answer: "PNG is lossless and best for text and line art, but the files are large. JPG is smaller and good for photos. WebP is usually the smallest of the three and is supported by current browsers and most apps.",
    },
    {
      question: "Why are my pictures missing something that shows in my PDF viewer?",
      answer: "The page is drawn by PDF.js, which handles most files but not every unusual feature. Annotations such as highlights and stamps are drawn, but fillable form fields may not appear. Tell us about a file that looks wrong.",
    },
    {
      question: "Can it handle a password-protected PDF?",
      answer: "No. Remove the password first, then drop the file here.",
    },
    {
      question: "How many pages can it do at once?",
      answer: "Up to 500 pages in one run, and it stops with what is finished if the pictures together grow past 400 MB. For long documents choose a page range or a lower resolution.",
    },
  ],
  related: ["images-to-pdf", "compress-pdf", "extract-pdf-pages", "pdf-organizer", "image-converter", "pdf-to-text"],
});
