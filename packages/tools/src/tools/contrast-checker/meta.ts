import { Contrast } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "contrast-checker",
  name: "WCAG Contrast Checker",
  tagline: "Check text and background contrast against WCAG AA and AAA.",
  description:
    "Enter a foreground and background color to see the exact WCAG contrast ratio and whether it passes AA and AAA for normal and large text. Includes a live text preview. Works offline in your browser.",
  primaryKeyword: "contrast checker",
  seoTitle: "WCAG Contrast Checker: AA and AAA Online",
  seoDescription:
    "Check the contrast ratio of text and background colors against WCAG AA and AAA for normal and large text. Free, with a live preview.",
  answer:
    "WCAG Contrast Checker shows the exact contrast ratio between a foreground and a background color and whether it passes WCAG AA and AAA for normal and large text. It includes a live text preview and works offline in your browser.",
  category: "design",
  keywords: ["contrast checker", "wcag contrast", "accessibility color", "color contrast ratio", "aa aaa", "a11y"],
  icon: Contrast,
  popular: true,
  howTo: ["Enter the text color and the background color.", "Read the contrast ratio and the AA and AAA results for normal and large text.", "Adjust a color until the checks you need pass."],
  faq: [
    { question: "What ratios do WCAG AA and AAA require?", answer: "AA needs 4.5:1 for normal text and 3:1 for large text (18pt, or 14pt bold). AAA needs 7:1 for normal text and 4.5:1 for large text." },
  ],
  nextStep: { slug: "color-converter", text: "Need the color in another format? Convert HEX, RGB, HSL and more." },
  related: ["color-converter", "palette-generator", "image-color-picker"],
});
