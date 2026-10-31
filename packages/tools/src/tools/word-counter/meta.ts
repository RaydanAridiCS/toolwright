import { TextCursorInput } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "word-counter",
  name: "Word & Character Counter",
  tagline: "Count words, characters, sentences and reading time as you type.",
  description:
    "Paste or type text to instantly count words, characters (with and without spaces), sentences, paragraphs, lines and UTF-8 bytes, plus estimated reading and speaking time. Everything is counted in your browser.",
  primaryKeyword: "word counter",
  seoTitle: "Word Counter and Character Counter",
  seoDescription:
    "Count words, characters with and without spaces, sentences, paragraphs and reading time as you type. Free, and private.",
  answer:
    "Word & Character Counter counts words, characters with and without spaces, sentences, paragraphs, lines and UTF-8 bytes as you type, and estimates reading and speaking time. Everything is counted in your browser.",
  category: "text",
  keywords: ["word count", "character count", "letter counter", "text length", "reading time", "sentence counter"],
  icon: TextCursorInput,
  popular: true,
  howTo: ["Paste or type your text into the box.", "Read the live statistics underneath.", "Use the word frequency tool to see which words you repeat most."],
  faq: [
    { question: "How is reading time calculated?", answer: "Reading time assumes an average adult pace of 230 words per minute; speaking time assumes 130 words per minute." },
    { question: "Does it count emoji and accented letters correctly?", answer: "Yes. Characters are counted as Unicode code points, so an emoji counts as one character. The byte count shows the UTF-8 size." },
  ],
  nextStep: { slug: "word-frequency", text: "Want to see which words repeat most? Count word frequency." },
  related: ["readability-score", "word-frequency", "case-converter", "line-tools", "pdf-to-text"],
});
