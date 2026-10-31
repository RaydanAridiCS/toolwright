import { Palette } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "palette-generator",
  name: "Color Palette Generator",
  tagline: "Build a 50–900 color scale and harmonies from one base color.",
  description:
    "Turn a single base color into a ten-step scale (50–900) and matching complementary, analogous, triadic, tetradic or monochromatic harmonies. Export as CSS variables or a Tailwind color object. Local only.",
  primaryKeyword: "color palette generator",
  seoTitle: "Color Palette Generator: 50-900 Shades",
  seoDescription:
    "Turn one base color into a 50-900 scale and complementary, analogous or triadic palettes. Export CSS variables or Tailwind. Free.",
  answer:
    "Color Palette Generator turns a single base color into a ten-step scale from 50 to 900 and matching complementary, analogous, triadic, tetradic or monochromatic harmonies. Export them as CSS variables or a Tailwind color object. It runs in your browser.",
  category: "design",
  keywords: ["color palette generator", "tailwind colors", "color scale", "color harmony", "shades generator", "css variables"],
  icon: Palette,
  howTo: ["Pick or type a base color.", "Choose a scale or a harmony.", "Copy the colors as CSS variables or a Tailwind object."],
  faq: [
    { question: "How do I make a color scale from one color?", answer: "Pick a base color. The tool builds a ten-step scale from 50 to 900 around it." },
    { question: "Can I use the palette in Tailwind?", answer: "Yes. You can copy the scale as a Tailwind color object or as CSS variables." },
    { question: "What are color harmonies?", answer: "Sets of colors related by position on the color wheel, such as complementary, analogous and triadic." },
  ],
  nextStep: { slug: "contrast-checker", text: "Checking text on these colors? Test their contrast." },
  related: ["color-converter", "contrast-checker", "image-color-picker"],
});
