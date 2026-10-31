import { FileCode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "html-to-markdown",
  name: "HTML to Markdown Converter",
  tagline: "Turn HTML into clean Markdown with headings, lists, links and tables.",
  description:
    "Paste HTML from a web page, email or CMS and get tidy GitHub-flavoured Markdown: headings, lists, links, code blocks and tables. Scripts and styles are dropped. It runs in your browser, so nothing is uploaded.",
  primaryKeyword: "html to markdown",
  seoTitle: "HTML to Markdown Converter Online",
  seoDescription:
    "Turn HTML from a web page, email or CMS into clean GitHub-flavored Markdown. Scripts and styles are dropped. Free, runs in your browser.",
  answer:
    "HTML to Markdown Converter turns pasted HTML into tidy GitHub-flavored Markdown, keeping headings, lists, links, code blocks and tables and dropping scripts and styles. It runs in your browser, so nothing is uploaded.",
  category: "text",
  keywords: ["html to markdown", "convert html to markdown", "html to md", "web page to markdown", "html table to markdown", "turndown alternative"],
  icon: FileCode,
  howTo: [
    "Paste the HTML, or open an .html file.",
    "Pick the bullet marker and whether to keep links and images.",
    "Copy the Markdown or download it as a .md file.",
  ],
  faq: [
    {
      question: "What gets left out?",
      answer: "Scripts, styles, iframes, forms, buttons and SVG graphics are dropped, because Markdown has no way to express them. Colours, fonts and layout are not kept either.",
    },
    {
      question: "How do I go from Markdown back to HTML?",
      answer: "Use the Markdown Previewer. Its HTML tab shows the generated HTML, and you can copy or download it.",
    },
    {
      question: "Are links to javascript: removed?",
      answer: "Yes. Links that run script keep only their text, so the Markdown you copy never carries a script link.",
    },
    {
      question: "Is my HTML uploaded anywhere?",
      answer: "No. The HTML is parsed and converted in your browser and never sent to a server.",
    },
  ],
  nextStep: { slug: "markdown-preview", text: "Want to check how the Markdown looks? Open the Markdown Previewer." },
  related: ["markdown-preview", "csv-to-markdown", "html-entities", "word-counter"],
});
