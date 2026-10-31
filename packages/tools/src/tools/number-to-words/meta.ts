import { Type } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "number-to-words",
  name: "Number to Words",
  tagline: "Spell out numbers in English, up to the quintillions.",
  description: "Convert numbers such as 1,234,567 into words (one million two hundred thirty-four thousand five hundred sixty-seven). Useful for cheques, contracts and invoices. Local only.",
  primaryKeyword: "number to words",
  seoTitle: "Number to Words Converter (Cheque Amounts)",
  seoDescription:
    "Spell out any number in English words, up to the quintillions. Useful for cheques, contracts and invoices. Free, in your browser.",
  answer:
    "Number to Words spells out numbers in English, such as 1,234,567 as one million two hundred thirty-four thousand five hundred sixty-seven, up to the quintillions. It is useful for cheques, contracts and invoices, and runs in your browser.",
  category: "calculators",
  keywords: ["number to words", "spell number", "numbers in words", "cheque amount in words", "convert number to text"],
  icon: Type,
  howTo: ["Type a number.", "Read the number written in words.", "Copy the words."],
  faq: [
    { question: "How do I write a number in words for a cheque?", answer: "Type the number and copy the words. Check the result against the figures before you use it on a legal document." },
    { question: "How large a number can it handle?", answer: "Up to the quintillions." },
    { question: "Does it write the words in English only?", answer: "Yes. The output is English." },
  ],
  nextStep: { slug: "roman-numerals", text: "Want the Roman numeral for a number? Convert it." },
  related: ["roman-numerals", "number-base-converter", "prime-factors"],
});
