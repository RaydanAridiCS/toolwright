import { ListOrdered } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "line-tools",
  name: "Sort & Dedupe Lines",
  tagline: "Sort, shuffle, reverse, trim and remove duplicate lines.",
  description:
    "Clean up lists in seconds: sort lines alphabetically, naturally or by length, remove duplicates and blank lines, trim whitespace, reverse or shuffle the order. Nothing is uploaded.",
  primaryKeyword: "sort lines",
  seoTitle: "Sort Lines and Remove Duplicate Lines Online",
  seoDescription:
    "Sort lines alphabetically, naturally or by length, remove duplicates and blank lines, trim, reverse or shuffle. Free, runs in your browser.",
  answer:
    "Sort & Dedupe Lines sorts a list alphabetically, naturally or by length, removes duplicate and blank lines, trims whitespace and reverses or shuffles the order. It runs in your browser, so your list is never uploaded.",
  category: "text",
  keywords: ["sort lines", "remove duplicate lines", "dedupe", "alphabetize", "shuffle lines", "unique lines", "remove blank lines"],
  icon: ListOrdered,
  popular: true,
  howTo: ["Paste your list, one item per line.", "Choose how to sort, and whether to remove duplicates or blank lines.", "Copy the cleaned list."],
  faq: [
    { question: "How do I remove duplicate lines?", answer: "Paste the list and turn on remove duplicates. Each line is kept once." },
    { question: "What is natural sort?", answer: "Natural sort puts numbers in numeric order, so item 2 comes before item 10 instead of after it." },
    { question: "Is my list uploaded?", answer: "No. The lines are processed in your browser." },
  ],
  nextStep: { slug: "whitespace-cleaner", text: "Messy spacing too? Remove extra spaces and line breaks." },
  related: ["find-and-replace", "whitespace-cleaner", "word-frequency"],
});
