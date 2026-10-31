import { CaseSensitive } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "case-converter",
  name: "Case Converter",
  tagline: "camelCase, snake_case, Title Case, UPPER CASE and more.",
  description:
    "Convert text between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, Title Case, Sentence case, UPPER and lower case. Multi-line input is converted line by line, entirely in your browser.",
  primaryKeyword: "case converter",
  seoTitle: "Case Converter: camelCase, snake_case & More",
  seoDescription:
    "Convert text to camelCase, PascalCase, snake_case, kebab-case, Title Case, UPPER or lower case online. Free, line by line, in your browser.",
  answer:
    "Case Converter changes text between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, Title Case, Sentence case, UPPER and lower case. Multi-line input is converted line by line, and nothing leaves your browser.",
  category: "text",
  keywords: ["camelcase", "snake case", "kebab case", "title case", "uppercase", "lowercase", "pascal case", "text case"],
  icon: CaseSensitive,
  popular: true,
  howTo: ["Paste or type your text.", "Pick the case you want, such as snake_case or Title Case.", "Copy the converted text."],
  faq: [
    { question: "How does it handle several lines?", answer: "Each line is converted on its own, so a list of names or variables keeps its line breaks." },
    { question: "What is the difference between camelCase and PascalCase?", answer: "camelCase starts with a lowercase letter (userName). PascalCase capitalizes the first letter as well (UserName)." },
    { question: "Is my text uploaded?", answer: "No. The conversion runs in your browser and nothing is sent anywhere." },
  ],
  nextStep: { slug: "slug-generator", text: "Turning titles into URLs? Make clean slugs with the Slug Generator." },
  related: ["slug-generator", "line-tools", "word-counter"],
});
