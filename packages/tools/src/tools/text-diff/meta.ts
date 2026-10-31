import { Diff } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "text-diff",
  name: "Text Diff Checker",
  tagline: "Compare two texts and see exactly what changed.",
  description:
    "Paste two versions of a text or code and see additions and deletions highlighted line by line, word by word or character by character. Side-by-side and inline views, plus a unified patch you can copy. Nothing leaves your browser.",
  primaryKeyword: "diff checker",
  seoTitle: "Diff Checker: Compare Two Texts Online",
  seoDescription:
    "Compare two texts or pieces of code and see additions and deletions line by line, word by word or by character. Free, runs in your browser.",
  answer:
    "Text Diff Checker compares two versions of a text or code and highlights additions and deletions line by line, word by word or character by character. It has side-by-side and inline views and a unified patch you can copy. Nothing leaves your browser.",
  category: "text",
  keywords: ["diff checker", "compare text", "text compare", "find differences", "code diff", "unified diff"],
  icon: Diff,
  popular: true,
  howTo: ["Paste the original text on the left and the changed text on the right.", "Choose line, word or character comparison.", "Switch between side-by-side and inline views, or copy the unified patch."],
  faq: [
    { question: "How do I compare two texts?", answer: "Paste one version on each side and the differences are highlighted straight away." },
    { question: "Can it compare code?", answer: "Yes. It works on any text, and the line-by-line view suits code." },
    { question: "Is my text uploaded?", answer: "No. The comparison runs in your browser." },
  ],
  nextStep: { slug: "json-diff", text: "Comparing JSON? Use the JSON Diff to ignore key order and spacing." },
  related: ["find-and-replace", "json-formatter", "line-tools", "json-diff"],
});
