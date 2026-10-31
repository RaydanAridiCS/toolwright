import { Languages } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "unicode-escape",
  name: "Unicode Escape & Unescape",
  tagline: "Convert characters to \\uXXXX escapes and back.",
  description:
    "Turn non-ASCII characters and emoji into \\uXXXX escape sequences for source code, or decode \\uXXXX and \\u{...} sequences back into readable text.",
  primaryKeyword: "unicode escape",
  seoTitle: "Unicode Escape and Unescape Converter",
  seoDescription:
    "Turn non-ASCII characters and emoji into u-escape sequences for source code, or decode them back into readable text. Free.",
  answer:
    "Unicode Escape & Unescape turns non-ASCII characters and emoji into escape sequences for source code, and decodes the four-digit and braced forms back into readable text. It runs in your browser.",
  category: "encoding",
  keywords: ["unicode escape", "unicode to text", "u escape sequence", "emoji to unicode", "utf-16 escape"],
  icon: Languages,
  howTo: ["Paste your text, or a string with escape sequences.", "Choose to escape or unescape.", "Copy the result."],
  faq: [
    { question: "What is a Unicode escape sequence?", answer: "A way to write a character with ASCII only, using its code point after a backslash and the letter u, for example the four-digit form for an accented e." },
    { question: "How are emoji written?", answer: "As a pair of four-digit escapes (a surrogate pair) or as one braced escape with the full code point, depending on the format you choose." },
    { question: "Is my text uploaded?", answer: "No. It is converted in your browser." },
  ],
  nextStep: { slug: "string-escape", text: "Escaping quotes and newlines as well? Use the String Escape tool." },
  related: ["string-escape", "hex-binary-converter", "html-entities"],
});
