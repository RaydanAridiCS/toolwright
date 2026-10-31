import { Code } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "html-entities",
  name: "HTML Entity Encoder & Decoder",
  tagline: "Escape &, <, > and quotes, or decode HTML entities.",
  description:
    "Escape special characters into HTML entities for safe embedding in markup, or decode named, decimal and hexadecimal entities such as &amp;, &copy; and &#x1F600;. Local only.",
  primaryKeyword: "html entities",
  seoTitle: "HTML Entities: Encode and Decode Online",
  seoDescription:
    "Escape special characters as HTML entities or decode named, decimal and hex entities such as &amp; and &copy;. Free, in your browser.",
  answer:
    "HTML Entity Encoder & Decoder escapes characters such as &, <, > and quotes into HTML entities so they are safe in markup, and decodes named, decimal and hexadecimal entities back into text. It runs in your browser.",
  category: "encoding",
  keywords: ["html entities", "html escape", "html unescape", "escape html", "decode html entities"],
  icon: Code,
  howTo: ["Paste your text or HTML.", "Choose encode or decode.", "Copy the result."],
  faq: [
    { question: "Why do I need to escape HTML?", answer: "Characters such as < and & have a meaning in HTML. Escaping them makes the browser show them as text instead of reading them as markup." },
    { question: "Which entities can it decode?", answer: "Named entities such as the ampersand and copyright signs, and decimal and hexadecimal numeric entities." },
    { question: "Is escaping enough to stop cross-site scripting?", answer: "Only when you escape for the right place. Text inside HTML needs entity escaping, but attributes, URLs and scripts need their own rules. Use your framework's escaping where you can." },
  ],
  nextStep: { slug: "url-encoder", text: "Working with links instead? Percent-encode a URL." },
  related: ["url-encoder", "string-escape", "markdown-preview"],
});
