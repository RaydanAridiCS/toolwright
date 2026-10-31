import { FileImage } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-converter",
  name: "Image Converter",
  tagline: "Convert between JPG, PNG, WebP and AVIF in your browser.",
  description:
    "Change image formats instantly: PNG to JPG, JPG to WebP, WebP to PNG and more. Handles transparency, supports batches and ZIP download, and never uploads your files.",
  primaryKeyword: "image converter",
  seoTitle: "Image Converter: PNG, JPG, WebP and AVIF",
  seoDescription:
    "Convert images between JPG, PNG, WebP and AVIF in your browser. Batch conversion with ZIP download. Free, no upload, no sign-up.",
  answer:
    "Image Converter changes image formats in your browser: PNG to JPG, JPG to WebP, WebP to PNG and more. It handles transparency, converts batches with a ZIP download, and never uploads your files.",
  category: "image",
  keywords: ["image converter", "png to jpg", "jpg to png", "webp to png", "convert to webp", "avif converter", "heic alternative"],
  icon: FileImage,
  popular: true,
  howTo: ["Drop one or more images.", "Choose the output format and quality.", "Download each image, or all of them as a ZIP."],
  faq: [
    { question: "How do I convert PNG to JPG?", answer: "Drop the PNG, choose JPG as the output format and download the result. Transparent areas are filled with a background color, because JPG has no transparency." },
    { question: "Is AVIF supported?", answer: "AVIF output depends on your browser, so the option is marked (if supported)." },
    { question: "Are my images uploaded?", answer: "No. They are converted in your browser and never leave your device." },
  ],
  nextStep: { slug: "image-compressor", text: "Converted and still too large? Compress the image further." },
  related: ["image-compressor", "image-resizer", "svg-to-png", "image-to-svg", "gif-maker", "image-crop"],
});
