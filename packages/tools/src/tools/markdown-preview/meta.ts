import { BookOpen } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "markdown-preview",
  name: "Markdown Previewer",
  tagline: "Write Markdown and see the rendered result live.",
  description:
    "A live GitHub-flavoured Markdown editor and previewer with tables, task lists and code blocks. Output is sanitized, and you can copy or download the generated HTML. Nothing is uploaded.",
  category: "text",
  keywords: ["markdown editor", "markdown preview", "markdown to html", "gfm", "readme editor"],
  icon: BookOpen,
  related: ["mermaid-editor", "text-diff", "word-counter", "html-entities", "html-to-markdown"],
});
