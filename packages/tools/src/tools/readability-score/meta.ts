import { BookOpenCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "readability-score",
  name: "Readability Score Checker",
  tagline: "Flesch, Flesch-Kincaid, Gunning Fog, SMOG and more for English text.",
  description:
    "Paste English text and get six standard readability scores, the school grade needed to follow it, reading time and the sentences that are hardest to read. It counts in your browser, so drafts stay private. Scores are guides, and syllable counting is approximate.",
  primaryKeyword: "readability score",
  seoTitle: "Readability Score Checker: Flesch and More",
  seoDescription:
    "Get Flesch, Flesch-Kincaid, Gunning Fog and SMOG scores, the school grade needed, and reading time for English text. Private.",
  answer:
    "Readability Score Checker gives six standard readability scores for English text, including Flesch Reading Ease, Flesch-Kincaid and Gunning Fog, plus the school grade needed to follow it, the reading time and the sentences that are hardest to read. Scores are guides, and syllable counting is approximate.",
  category: "text",
  keywords: ["readability score", "flesch reading ease", "flesch kincaid grade level", "gunning fog index", "smog index", "reading level checker", "text readability test"],
  icon: BookOpenCheck,
  howTo: ["Paste at least 100 words of English text.", "Read the Flesch score and the grade levels. Lower grades and higher Flesch scores are easier.", "Check the sentences listed as worth a second look, and shorten them."],
  faq: [
    {
      question: "How is this different from the word counter?",
      answer: "The word counter counts words, characters and reading time. This tool adds the standard readability formulas, the school grade level, and a list of your hardest sentences. It does not repeat the character and byte counts.",
    },
    {
      question: "Are the scores exact?",
      answer: "The formulas are the published ones, but they depend on counting syllables, which is approximate in English (a rule of thumb plus a short list of irregular words). Expect a few tenths of a grade of error. Treat the scores as a guide, not a grade.",
    },
    {
      question: "Does it work for other languages?",
      answer: "No. These formulas were designed for English. For other languages the numbers will not mean much, and the tool warns you when the text does not look English.",
    },
    {
      question: "Is my text uploaded?",
      answer: "No. It is analysed in your browser, and kept out of the address bar, so unpublished drafts stay on your device.",
    },
    {
      question: "What score should I aim for?",
      answer: "For general web content, a Flesch Reading Ease of 60 to 70 (plain English) and a grade level around 7 to 9 is a common target. Technical or legal writing is often harder, and that can be fine for its audience.",
    },
  ],
  nextStep: { slug: "word-counter", text: "Want the plain counts too? Count words, characters and sentences." },
  related: ["word-counter", "word-frequency", "case-converter", "text-diff", "lorem-ipsum"],
});
