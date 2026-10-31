import { Eraser } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "whitespace-cleaner",
  name: "Remove Extra Spaces & Line Breaks",
  tagline: "Collapse spaces, trim lines and remove blank lines.",
  description:
    "Fix messy pasted text by collapsing repeated spaces, trimming each line, collapsing blank lines or joining everything onto one line. All processing happens locally.",
  primaryKeyword: "remove extra spaces",
  seoTitle: "Remove Extra Spaces and Line Breaks from Text",
  seoDescription:
    "Collapse repeated spaces, trim each line, remove blank lines or join everything onto one line. Free, and runs in your browser.",
  answer:
    "Remove Extra Spaces & Line Breaks fixes messy pasted text by collapsing repeated spaces, trimming each line, collapsing blank lines or joining everything onto one line. All processing happens in your browser.",
  category: "text",
  keywords: ["remove extra spaces", "remove line breaks", "trim whitespace", "clean text", "strip newlines"],
  icon: Eraser,
  howTo: ["Paste your text.", "Choose what to clean: spaces, line ends or blank lines.", "Copy the cleaned text."],
  faq: [
    { question: "How do I remove extra spaces from text?", answer: "Paste the text and turn on collapse spaces. Runs of spaces become a single space." },
    { question: "How do I remove line breaks?", answer: "Choose the option that joins the text onto one line." },
    { question: "Is my text uploaded?", answer: "No. The cleanup runs in your browser." },
  ],
  nextStep: { slug: "line-tools", text: "Sorting or deduplicating lines too? Use Sort & Dedupe Lines." },
  related: ["line-tools", "find-and-replace", "word-counter"],
});
