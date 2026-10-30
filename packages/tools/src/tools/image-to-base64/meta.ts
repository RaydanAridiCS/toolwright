import { FileCode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-to-base64",
  name: "Image to Base64 & Data URI",
  tagline: "Embed an image as a Base64 data URI, or turn Base64 back into an image.",
  description:
    "Convert an image to a Base64 data URI for use in HTML, CSS or Markdown, with ready-made snippets. You can also paste Base64 to preview and download the image. Runs locally; your image is not uploaded.",
  category: "image",
  keywords: ["image to base64", "base64 to image", "data uri", "inline image", "base64 image encoder", "embed image css"],
  icon: FileCode,
  related: ["base64-encoder", "image-compressor", "svg-data-uri", "mime-types"],
});
