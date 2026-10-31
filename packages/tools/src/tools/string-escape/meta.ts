import { Code } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "string-escape",
  name: "String Escape & Unescape",
  tagline: "Escape text for JSON, JavaScript, Python, SQL or the shell.",
  description:
    "Escape quotes, newlines and backslashes so text can live inside a string literal in JSON, JavaScript, Python, C#, SQL or a POSIX shell, or unescape sequences like \\n, \\t and \\u00e9 back to characters.",
  primaryKeyword: "escape string",
  seoTitle: "Escape String: JSON, JavaScript, SQL, Shell",
  seoDescription:
    "Escape quotes, newlines and backslashes for JSON, JavaScript, Python, C#, SQL or the shell, or unescape them back. Free, in your browser.",
  answer:
    "String Escape & Unescape escapes quotes, newlines and backslashes so text can sit inside a string literal in JSON, JavaScript, Python, C#, SQL or a POSIX shell, and unescapes escape sequences back into characters. It runs in your browser.",
  category: "encoding",
  keywords: ["escape string", "unescape string", "json escape", "sql escape", "shell escape", "backslash escape"],
  icon: Code,
  howTo: ["Paste your text.", "Choose the language and whether to escape or unescape.", "Copy the result."],
  faq: [
    { question: "How do I escape a string for JSON?", answer: "Paste the text, choose JSON and copy the escaped result, ready to put between double quotes." },
    { question: "Which languages are supported?", answer: "JSON, JavaScript, Python, C#, SQL and POSIX shell." },
    { question: "Is escaping enough to prevent SQL injection?", answer: "No. Use parameterized queries. Escaping is for building literals by hand, not a security measure." },
  ],
  nextStep: { slug: "unicode-escape", text: "Need Unicode escape sequences specifically? Convert them." },
  related: ["html-entities", "json-formatter", "unicode-escape"],
});
