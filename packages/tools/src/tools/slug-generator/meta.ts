import { Link } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "slug-generator",
  name: "Slug Generator",
  tagline: "Turn titles into clean, URL-friendly slugs.",
  description:
    "Create SEO-friendly URL slugs from any text. Accents are removed, punctuation is dropped and words are joined with the separator you choose. One slug per line, generated in your browser.",
  primaryKeyword: "slug generator",
  seoTitle: "Slug Generator: Clean URL Slugs from Text",
  seoDescription:
    "Turn titles into clean, URL-friendly slugs. Accents are removed and words are joined with the separator you choose. Free, in your browser.",
  answer:
    "Slug Generator creates clean URL slugs from any text. Accents are removed, punctuation is dropped and words are joined with the separator you choose. It makes one slug per line and runs in your browser.",
  category: "text",
  keywords: ["slugify", "url slug", "seo friendly url", "permalink", "kebab case"],
  icon: Link,
  howTo: ["Paste your title or titles, one per line.", "Choose the separator.", "Copy the slugs."],
  faq: [
    { question: "What is a URL slug?", answer: "The readable last part of a web address, such as how-to-compress-a-pdf in example.com/guides/how-to-compress-a-pdf." },
    { question: "What makes a good slug?", answer: "Short, lowercase, made of words people would search for, and separated by hyphens." },
    { question: "Can I make several slugs at once?", answer: "Yes. Put one title per line." },
  ],
  nextStep: { slug: "case-converter", text: "Need another text case? Convert to camelCase, snake_case and more." },
  related: ["case-converter", "url-encoder", "utm-builder"],
});
