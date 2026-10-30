import { ImageDown } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-compressor",
  name: "Image Compressor",
  tagline: "Shrink JPG, PNG and WebP images without uploading them anywhere.",
  description:
    "Compress photos and graphics right in your browser. Adjust the quality, optionally resize, and compare file sizes before and after. Batch many images at once and download them together as a ZIP. Your images never leave your device.",
  category: "image",
  keywords: ["image compressor", "compress jpg", "compress png", "reduce image size", "optimize images", "tinypng alternative", "shrink photo"],
  icon: ImageDown,
  popular: true,
  howTo: ["Drop one or more images.", "Pick a quality (75% is a good start) or choose WebP for the smallest files.", "Check the before and after sizes, then download."],
  faq: [
    { question: "Is my image uploaded to a server?", answer: "No. Compression uses your browser's canvas, so the image stays on your device. You can verify this with your browser's network tab." },
    { question: "Will compression remove EXIF metadata?", answer: "Yes. Re-encoding through the canvas drops EXIF and other metadata, including GPS location. Use the EXIF Remover if you want to strip metadata without recompressing." },
  ],
  related: ["image-converter", "image-resizer", "exif-remover", "gif-editor", "svg-optimizer", "image-crop"],
});
