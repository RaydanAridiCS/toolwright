import { Link2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-data-uri",
  name: "SVG to Data URI",
  tagline: "Turn an SVG into a CSS or HTML data URI you can paste.",
  description:
    "Convert an SVG into a data URI for CSS backgrounds, masks, img tags or Markdown. The URL-encoded form is usually much smaller than Base64. It runs in your browser, so your file is never uploaded.",
  primaryKeyword: "svg to data uri",
  seoTitle: "SVG to Data URI Converter for CSS and HTML",
  seoDescription:
    "Convert an SVG into a data URI for CSS backgrounds, masks, img tags or Markdown. The URL-encoded form is smaller than Base64. Free.",
  answer:
    "SVG to Data URI converts an SVG into a data URI for CSS backgrounds, masks, img tags and Markdown. The URL-encoded form is usually much smaller than Base64. It runs in your browser, so your file is never uploaded.",
  category: "developer",
  keywords: ["svg to data uri", "svg data url", "svg css background", "inline svg css", "svg base64", "svg url encode", "svg to base64", "css mask svg"],
  icon: Link2,
  howTo: [
    "Paste your SVG or drop the file.",
    "Pick CSS background, mask, img tag, Markdown or just the URI.",
    "Copy the result into your stylesheet or HTML.",
  ],
  faq: [
    {
      question: "Why is URL-encoded smaller than Base64?",
      answer: "Base64 makes every file about a third bigger. An SVG is already text, so only a few characters need escaping, which adds far less. Use Base64 only for tools that cannot read the plain form.",
    },
    {
      question: "Is my SVG uploaded?",
      answer: "No. The conversion happens in your browser.",
    },
    {
      question: "Can I change the colour of an SVG used as a CSS background?",
      answer: "No, an SVG used as a background or img cannot take colour from CSS. Use the mask option with a background colour instead, or put the SVG inline in the page.",
    },
    {
      question: "What does it change in my SVG?",
      answer: "It adds the SVG namespace if missing, removes comments and the XML declaration, switches attributes to single quotes, and tidies whitespace so the string is as short as it can be.",
    },
  ],
  nextStep: { slug: "svg-optimizer", text: "Smaller input gives a smaller URI. Optimize the SVG first." },
  related: ["svg-optimizer", "svg-to-react", "image-to-base64", "base64-encoder"],
});
