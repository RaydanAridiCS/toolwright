import { FileCode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-to-base64",
  name: "Image to Base64 & Data URI",
  tagline: "Embed an image as a Base64 data URI, or turn Base64 back into an image.",
  description:
    "Convert an image to a Base64 data URI for use in HTML, CSS or Markdown, with ready-made snippets. You can also paste Base64 to preview and download the image. Runs locally; your image is not uploaded.",
  primaryKeyword: "image to base64",
  seoTitle: "Image to Base64 Converter and Data URI",
  seoDescription:
    "Convert an image to a Base64 data URI for HTML, CSS or Markdown, or turn Base64 back into an image. Free, and nothing is uploaded.",
  answer:
    "Image to Base64 & Data URI converts an image into a Base64 data URI with ready-made HTML, CSS and Markdown snippets, and turns pasted Base64 back into an image you can preview and download. It runs locally, so the image is not uploaded.",
  category: "image",
  keywords: ["image to base64", "base64 to image", "data uri", "inline image", "base64 image encoder", "embed image css"],
  icon: FileCode,
  howTo: ["Drop an image, or paste a Base64 string.", "Copy the data URI or the HTML, CSS or Markdown snippet.", "Or preview and download the image from Base64."],
  faq: [
    { question: "How do I convert an image to Base64?", answer: "Drop the image and copy the data URI or one of the ready-made snippets." },
    { question: "Does Base64 make an image bigger?", answer: "Yes. Base64 text is about a third larger than the original bytes, so use it for small images such as icons." },
    { question: "Can I turn Base64 back into an image?", answer: "Yes. Paste the Base64 string, preview the picture and download it." },
  ],
  nextStep: { slug: "svg-data-uri", text: "Embedding an SVG? Its URL-encoded data URI is usually smaller." },
  related: ["base64-encoder", "image-compressor", "svg-data-uri", "mime-types"],
});
