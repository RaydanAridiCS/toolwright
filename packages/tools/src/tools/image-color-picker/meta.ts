import { Droplets } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-color-picker",
  name: "Image Color Picker",
  tagline: "Pick exact colors from any image and extract its dominant palette.",
  description:
    "Click anywhere on an image to read the exact HEX and RGB value, and see the dominant colors extracted automatically. Perfect for matching brand colors from a logo or screenshot. Runs on your device.",
  primaryKeyword: "color picker from image",
  seoTitle: "Color Picker from Image: Get HEX and RGB",
  seoDescription:
    "Click anywhere on an image to read its HEX and RGB value and see its dominant colors. Free, and the picture stays on your device.",
  answer:
    "Image Color Picker gets a color from an image: click any pixel to read its exact HEX and RGB value, and see the dominant colors it extracts. It runs on your device, so the picture is never uploaded.",
  category: "design",
  keywords: ["image color picker", "color from image", "eyedropper", "extract colors from image", "dominant colors", "palette from photo"],
  icon: Droplets,
  howTo: ["Drop an image into the box.", "Click a spot on the picture, or read the dominant colors.", "Copy the HEX or RGB value."],
  faq: [
    { question: "How do I get a color from an image?", answer: "Drop the image and click the spot you want. The HEX and RGB values appear, ready to copy." },
    { question: "Can it find the main colors of a picture?", answer: "Yes. It shows the dominant colors it extracts from the image." },
    { question: "Is my image uploaded?", answer: "No. The picture is read in your browser and stays on your device." },
  ],
  nextStep: { slug: "palette-generator", text: "Want matching shades? Build a color scale from the color you picked." },
  related: ["color-converter", "palette-generator", "contrast-checker"],
});
