import { Regex } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "regex-tester",
  name: "Regex Tester",
  tagline: "Test JavaScript regular expressions with live match highlighting.",
  description:
    "Write a regular expression and watch matches highlight live. See capture groups, named groups and positions, try replacements, and start from common presets such as email, URL and IP address. Uses your browser's JavaScript regex engine; nothing is uploaded.",
  primaryKeyword: "regex tester",
  seoTitle: "Regex Tester: Test JavaScript Regex Online",
  seoDescription:
    "Write a regular expression and see matches highlight live, with groups, positions and replacements. Free, in your browser.",
  answer:
    "Regex Tester lets you write a regular expression and watch the matches highlight live. It shows capture groups, named groups and positions, tries replacements and offers presets for email, URL and IP address. It uses your browser's JavaScript regex engine and uploads nothing.",
  category: "developer",
  keywords: ["regex tester", "regular expression", "regex101 alternative", "javascript regex", "regex match", "capture groups"],
  icon: Regex,
  popular: true,
  howTo: ["Enter a pattern and pick flags.", "Paste the text you want to test against.", "Matches highlight live; expand the list to see groups, or try a replacement."],
  faq: [
    { question: "Which regex flavor does it use?", answer: "JavaScript, through your browser's built-in engine. Other flavors such as PCRE or Python can differ in details like lookbehind and named group syntax." },
    { question: "Can I test a replacement?", answer: "Yes. Enter a replacement string, including group references, and see the result." },
    { question: "Is my text uploaded?", answer: "No. Matching runs in your browser." },
  ],
  nextStep: { slug: "find-and-replace", text: "Ready to apply the pattern? Run a bulk find and replace." },
  related: ["find-and-replace", "text-diff", "cron-explainer"],
});
