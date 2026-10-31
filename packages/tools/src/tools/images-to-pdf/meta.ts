import { FileInput } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "images-to-pdf",
  name: "Images to PDF",
  tagline: "Turn JPG, PNG and WebP images into a single PDF.",
  description:
    "Combine photos and scans into one PDF. Reorder pages, choose A4, Letter or fit-to-image page sizes, and set margins. Images are converted in your browser and never uploaded.",
  primaryKeyword: "jpg to pdf",
  seoTitle: "JPG to PDF Converter: Images to One PDF",
  seoDescription:
    "Combine JPG, PNG and WebP images into one PDF. Reorder pages, pick A4, Letter or fit-to-image size. Free, and nothing is uploaded.",
  answer:
    "Images to PDF turns JPG, PNG and WebP images into a single PDF in your browser. Put the pictures in order, choose A4, Letter or fit-to-image pages and set margins. Nothing is uploaded.",
  category: "pdf",
  keywords: ["images to pdf", "jpg to pdf", "png to pdf", "photos to pdf", "convert image to pdf", "scan to pdf"],
  icon: FileInput,
  popular: true,
  howTo: ["Drop your images into the box.", "Put them in order and choose the page size and margin.", "Download the PDF."],
  faq: [
    { question: "How do I convert JPG to PDF?", answer: "Drop your JPG files, put them in order, choose a page size and download the PDF." },
    { question: "Can I combine several images into one PDF?", answer: "Yes. Each image becomes a page, and you can reorder them before you save." },
    { question: "Are my images uploaded?", answer: "No. The PDF is built in your browser." },
  ],
  nextStep: { slug: "compress-pdf", text: "PDF too large? Compress it next." },
  related: ["merge-pdf", "image-converter", "image-compressor", "compress-pdf", "pdf-to-images"],
});
