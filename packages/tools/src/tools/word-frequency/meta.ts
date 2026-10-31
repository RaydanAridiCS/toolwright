import { Sigma } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "word-frequency",
  name: "Word Frequency Counter",
  tagline: "See which words appear most often in your text.",
  description: "Rank the words in any text by how often they appear. Useful for editing, SEO keyword checks and spotting overused words. Runs in your browser.",
  primaryKeyword: "word frequency counter",
  seoTitle: "Word Frequency Counter: Most Common Words",
  seoDescription:
    "Rank the words in any text by how often they appear. Handy for editing, keyword checks and spotting overused words. Free.",
  answer:
    "Word Frequency Counter ranks the words in a text by how often they appear, which helps with editing, checking keywords and spotting overused words. It runs in your browser, so your text is never uploaded.",
  category: "text",
  keywords: ["word frequency", "keyword density", "most common words", "word occurrences", "repeated words"],
  icon: Sigma,
  howTo: ["Paste your text.", "Read the words ranked by how often they appear.", "Copy the list if you need it."],
  faq: [
    { question: "How do I find the most common words in a text?", answer: "Paste the text and read the ranked list, with the most frequent word first." },
    { question: "Is this the same as keyword density?", answer: "It shows how often each word appears, which you can compare with the total number of words to get a density. Treat it as an editing aid, not a ranking target." },
    { question: "Is my text uploaded?", answer: "No. It is counted in your browser." },
  ],
  nextStep: { slug: "word-counter", text: "Need totals as well? Count words, characters and sentences." },
  related: ["word-counter", "line-tools", "case-converter"],
});
