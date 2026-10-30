import { FileImage } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-converter",
  name: "Image Converter",
  tagline: "Convert between JPG, PNG, WebP and AVIF in your browser.",
  description:
    "Change image formats instantly: PNG to JPG, JPG to WebP, WebP to PNG and more. Handles transparency, supports batches and ZIP download, and never uploads your files.",
  category: "image",
  keywords: ["image converter", "png to jpg", "jpg to png", "webp to png", "convert to webp", "avif converter", "heic alternative"],
  icon: FileImage,
  popular: true,
  related: ["image-compressor", "image-resizer", "svg-to-png", "image-to-svg", "gif-maker", "image-crop"],
});
