import { Scaling } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-resizer",
  name: "Image Resizer",
  tagline: "Resize images by pixels or percentage, in bulk.",
  description:
    "Resize photos to a maximum width and height, an exact size or a percentage, keeping the aspect ratio. Batch resize and download as a ZIP. Runs in your browser with no upload.",
  primaryKeyword: "resize image",
  seoTitle: "Resize Image Online: Pixels or Percent",
  seoDescription:
    "Resize photos to an exact size, a maximum width and height or a percentage, keeping the aspect ratio. Batch resize with no upload.",
  answer:
    "Image Resizer changes the dimensions of JPG, PNG and WebP images in your browser, by exact pixels, a maximum width and height or a percentage, keeping the aspect ratio. Batch resize and download a ZIP. Nothing is uploaded.",
  category: "image",
  keywords: ["image resizer", "resize image", "resize photo", "change image dimensions", "bulk resize", "scale image"],
  icon: Scaling,
  popular: true,
  howTo: ["Drop one or more images.", "Choose a maximum size, an exact size or a percentage.", "Download the resized images."],
  faq: [
    { question: "How do I resize an image without losing quality?", answer: "Making an image smaller keeps it sharp, while making it bigger cannot add detail. Keep the aspect ratio locked and save to a lossless format such as PNG if you need to avoid extra compression." },
    { question: "Can I resize many images at once?", answer: "Yes. Drop several images, set the size once and download them together as a ZIP." },
    { question: "Are my images uploaded?", answer: "No. Resizing happens in your browser." },
  ],
  nextStep: { slug: "image-compressor", text: "Next, shrink the file size with the Image Compressor." },
  related: ["image-compressor", "image-converter", "exif-remover", "gif-editor", "favicon-generator", "image-crop"],
});
