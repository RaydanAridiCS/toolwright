import { Scaling } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-resizer",
  name: "Image Resizer",
  tagline: "Resize images by pixels or percentage, in bulk.",
  description:
    "Resize photos to a maximum width and height, an exact size or a percentage, keeping the aspect ratio. Batch resize and download as a ZIP. Runs in your browser with no upload.",
  category: "image",
  keywords: ["image resizer", "resize image", "resize photo", "change image dimensions", "bulk resize", "scale image"],
  icon: Scaling,
  popular: true,
  related: ["image-compressor", "image-converter", "exif-remover", "gif-editor", "favicon-generator", "image-crop"],
});
