import { BookOpen } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "markdown-preview",
  name: "Markdown Previewer",
  tagline: "Write Markdown and see the rendered result live.",
  description:
    "A live GitHub-flavoured Markdown editor and previewer with tables, task lists and code blocks. Output is sanitized, and you can copy or download the generated HTML. Nothing is uploaded.",
  primaryKeyword: "markdown editor",
  seoTitle: "Markdown Editor and Live Previewer Online",
  seoDescription:
    "Write GitHub-flavored Markdown and see it rendered live, with tables, task lists and code blocks. Copy the HTML. Free, in your browser.",
  answer:
    "Markdown Previewer is a live GitHub-flavored Markdown editor with tables, task lists and code blocks. The output is sanitized, and you can copy or download the generated HTML. Nothing is uploaded.",
  category: "text",
  keywords: ["markdown editor", "markdown preview", "markdown to html", "gfm", "readme editor"],
  icon: BookOpen,
  howTo: ["Type or paste Markdown on the left.", "Watch the preview update.", "Copy the Markdown or the generated HTML."],
  faq: [
    { question: "Which Markdown does it support?", answer: "GitHub-flavored Markdown: headings, lists, links, tables, task lists and fenced code blocks." },
    { question: "Can I get the HTML?", answer: "Yes. You can copy or download the generated HTML." },
    { question: "Is the output safe?", answer: "The rendered HTML is sanitized before it is shown, so scripts in your text do not run." },
  ],
  nextStep: { slug: "html-to-markdown", text: "Starting from HTML? Convert it to Markdown." },
  related: ["mermaid-editor", "text-diff", "word-counter", "html-entities", "html-to-markdown"],
});
