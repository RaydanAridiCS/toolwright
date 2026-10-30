import { Shapes } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-to-png",
  name: "SVG to PNG Converter",
  tagline: "Rasterize SVG files to PNG, JPG or WebP at any size.",
  description:
    "Paste SVG code or drop an SVG file and export a crisp PNG, JPEG or WebP at 1× to 8× scale or an exact width, with a transparent or colored background. Rendering happens in your browser's sandbox.",
  category: "image",
  keywords: ["svg to png", "convert svg", "svg to jpg", "rasterize svg", "svg export", "svg to image"],
  icon: Shapes,
  related: ["mermaid-editor", "image-converter", "image-resizer", "svg-editor", "svg-optimizer"],
});
