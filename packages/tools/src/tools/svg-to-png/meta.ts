import { Shapes } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-to-png",
  name: "SVG to PNG Converter",
  tagline: "Rasterize SVG files to PNG, JPG or WebP at any size.",
  description:
    "Paste SVG code or drop an SVG file and export a crisp PNG, JPEG or WebP at 1× to 8× scale or an exact width, with a transparent or colored background. Rendering happens in your browser's sandbox.",
  primaryKeyword: "svg to png",
  seoTitle: "SVG to PNG Converter: Any Size, Transparent",
  seoDescription:
    "Convert SVG code or files to PNG, JPG or WebP at 1x to 8x or an exact width, with a transparent background. Free, in your browser.",
  answer:
    "SVG to PNG Converter rasterizes SVG code or files to PNG, JPEG or WebP at 1x to 8x scale or an exact width, with a transparent or colored background. Rendering happens in your browser's sandbox, so nothing is uploaded.",
  category: "image",
  keywords: ["svg to png", "convert svg", "svg to jpg", "rasterize svg", "svg export", "svg to image"],
  icon: Shapes,
  howTo: ["Paste SVG code or drop an SVG file.", "Choose the format, size and background.", "Download the picture."],
  faq: [
    { question: "How do I convert SVG to PNG?", answer: "Paste the SVG code or drop the file, choose the size and format, and download the picture." },
    { question: "Can the PNG have a transparent background?", answer: "Yes. Choose a transparent background for PNG or WebP. JPG has no transparency and uses a color." },
    { question: "How big can the PNG be?", answer: "You can choose 1x to 8x or an exact width. Very large sizes may be refused by your browser's canvas limit." },
  ],
  nextStep: { slug: "image-compressor", text: "PNG too heavy? Compress it." },
  related: ["mermaid-editor", "image-converter", "image-resizer", "svg-editor", "svg-optimizer"],
});
