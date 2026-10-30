import { FileInput } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "images-to-pdf",
  name: "Images to PDF",
  tagline: "Turn JPG, PNG and WebP images into a single PDF.",
  description:
    "Combine photos and scans into one PDF. Reorder pages, choose A4, Letter or fit-to-image page sizes, and set margins. Images are converted in your browser and never uploaded.",
  category: "pdf",
  keywords: ["images to pdf", "jpg to pdf", "png to pdf", "photos to pdf", "convert image to pdf", "scan to pdf"],
  icon: FileInput,
  popular: true,
  related: ["merge-pdf", "image-converter", "image-compressor", "compress-pdf"],
});
