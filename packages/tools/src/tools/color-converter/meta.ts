import { Pipette } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "color-converter",
  name: "Color Converter & Picker",
  tagline: "Convert between HEX, RGB, HSL, HSV, CMYK and OKLCH.",
  description:
    "Pick or type a color and get it in HEX, RGB, HSL, HSV, CMYK and OKLCH, ready to copy. Supports alpha, CSS color names and the browser eyedropper where available. Runs entirely on your device.",
  primaryKeyword: "color converter",
  seoTitle: "Color Converter: HEX, RGB, HSL, CMYK, OKLCH",
  seoDescription:
    "Convert colors between HEX, RGB, HSL, HSV, CMYK and OKLCH online. Pick a color, use the eyedropper and copy any value. Free, no upload.",
  answer:
    "Color Converter turns one color into HEX, RGB, HSL, HSV, CMYK and OKLCH values you can copy. Type a value or a CSS color name, pick a color, or use the browser eyedropper where it is available. Everything runs on your device.",
  category: "design",
  keywords: ["color converter", "hex to rgb", "rgb to hex", "hsl converter", "color picker", "oklch", "css colors"],
  icon: Pipette,
  popular: true,
  howTo: ["Pick a color, or type a HEX, RGB, HSL or CSS color name.", "Read the same color in every format.", "Copy the value you need."],
  faq: [
    { question: "How do I convert HEX to RGB?", answer: "Type or paste the HEX code. The RGB value appears next to the other formats, ready to copy." },
    { question: "Does it support transparency?", answer: "Yes. It supports an alpha (opacity) value alongside the color." },
    { question: "What is OKLCH?", answer: "OKLCH is a CSS color notation made of lightness, chroma and hue. Colors with the same lightness look about equally light, which helps when you build palettes." },
  ],
  nextStep: { slug: "contrast-checker", text: "Using this color for text? Check its contrast against the background." },
  related: ["contrast-checker", "palette-generator", "image-color-picker"],
});
