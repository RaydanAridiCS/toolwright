import { Replace } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "find-and-replace",
  name: "Find & Replace",
  tagline: "Bulk find and replace text with optional regular expressions.",
  description:
    "Search and replace across any amount of text with case, whole-word and regular-expression options. Capture groups like $1 work in regex mode. Runs locally in your browser.",
  primaryKeyword: "find and replace text",
  seoTitle: "Find and Replace Text Online with Regex",
  seoDescription:
    "Bulk find and replace in any amount of text, with case, whole-word and regular expression options. Free, private, runs in your browser.",
  answer:
    "Find & Replace searches and replaces text in bulk, with options for case, whole words and regular expressions. Capture groups such as $1 work in regex mode. It runs in your browser, so your text is never uploaded.",
  category: "text",
  keywords: ["find and replace", "search and replace", "regex replace", "bulk replace", "text replace"],
  icon: Replace,
  howTo: ["Paste your text.", "Type what to find and what to replace it with, and pick the options.", "Copy the result."],
  faq: [
    { question: "Can I use regular expressions?", answer: "Yes. Turn on regex mode, and use capture groups such as $1 in the replacement." },
    { question: "Is it case sensitive?", answer: "That is your choice. There are options for matching case and for whole words only." },
    { question: "Is my text uploaded?", answer: "No. The replacement runs in your browser." },
  ],
  nextStep: { slug: "regex-tester", text: "Not sure your pattern is right? Test it in the Regex Tester." },
  related: ["regex-tester", "line-tools", "case-converter"],
});
